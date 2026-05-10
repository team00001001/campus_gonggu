const express = require('express');
const router = express.Router();
const pool = require('../db');

// 크림슨 지수 계산 공통 함수 (파일이 달라서 여기도 선언해줍니다)
async function updateTrustScore(userId, delta, conn) {
    await conn.query(`
        UPDATE users
        SET trust_score = LEAST(100, GREATEST(-100, trust_score + ?))
        WHERE id = ?
    `, [delta, userId]);
}

// [API] 방장 신고 접수
router.post('/', async (req, res) => {
    const { reporterId, productId } = req.body;
    const conn = await pool.promise().getConnection();

    try {
        await conn.beginTransaction();

        const [[product]] = await conn.query(`SELECT user_id FROM products WHERE id=?`, [productId]);
        if (!product) {
            await conn.rollback();
            return res.status(404).json({ message: '상품 없음' });
        }
        const hostId = product.user_id;

        // 1. 신고 기록 추가 (UNIQUE 제약조건 덕분에 중복 신고는 catch로 빠짐)
        await conn.query(`
            INSERT INTO reports (reporter_id, reported_id, product_id)
            VALUES (?, ?, ?)
        `, [reporterId, hostId, productId]);

        // 2. 참여자 수와 신고 수 조회
        const [[countRow]] = await conn.query(`
            SELECT COUNT(*) AS cnt FROM product_participants
            WHERE product_id = ? AND status != 'cancelled'
        `, [productId]);
        
        const [[reportRow]] = await conn.query(`
            SELECT COUNT(*) AS cnt FROM reports WHERE product_id = ?
        `, [productId]);

        const participantCount = countRow.cnt;
        const reportCount = reportRow.cnt;
        const threshold = participantCount <= 3 ? 1 : 2;

        // 3. 신고 기준 충족 시 점수 차감
        if (reportCount >= threshold) {
            await updateTrustScore(hostId, -20, conn);
            await conn.query(`UPDATE products SET status = 'reported' WHERE id = ?`, [productId]);
        }

        await conn.commit();
        res.json({ success: true, message: '신고가 접수되었습니다.' });
    } catch (err) {
        await conn.rollback();
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: '이미 신고한 공구입니다.' });
        }
        console.error(err);
        res.status(500).json({ message: '신고 처리 실패' });
    } finally {
        conn.release();
    }
});

module.exports = router;