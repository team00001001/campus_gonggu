const express = require('express');
const router = express.Router();
const pool = require('../db');
const createNotification = require('../utils/createNotification');

// 크림슨 지수 계산 공통 함수
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

        const [[product]] = await pool.promise().query(`SELECT user_id, title FROM products WHERE id=?`, [productId]);
        if (!product) {
            await conn.rollback();
            return res.status(404).json({ message: '상품 없음' });
        }
        const hostId = product.user_id;
        const productTitle = product.title;

        // 1. 신고 기록 추가
        await conn.query(`
            INSERT INTO reports (reporter_id, reported_id, product_id)
            VALUES (?, ?, ?)
        `, [reporterId, hostId, productId]);

        // 2. 총 신고 횟수 조회
        const [[reportRow]] = await conn.query(`
            SELECT COUNT(*) AS cnt FROM reports WHERE product_id = ?
        `, [productId]);
        const reportCount = Number(reportRow.cnt);

        // 3. ⭐️ 첫 번째 신고일 때만 페널티(20점 차감) 부여
        if (reportCount === 1) {
            await updateTrustScore(hostId, -20, conn);
        }

        await conn.commit();

        // 4. ⭐️ 방장 알림은 매번 전송 (메시지 내용만 분기)
        let noticeMessage = `개설하신 "${productTitle}" 공구에 신고가 접수되었습니다.`;
        if (reportCount === 1) {
            noticeMessage += ` 크림슨 지수가 20점 차감되었습니다. 억울한 상황이라면 운영진에게 문의해주세요.`;
        } else {
            noticeMessage += ` (현재 누적 신고 횟수: ${reportCount}회)`;
        }

        createNotification(
            hostId,
            '공구 신고 접수 안내',
            noticeMessage,
            'notice',
            productId
        );

        // 5. 신고자 알림은 항상 전송
        createNotification(
            reporterId,
            '신고 처리 완료',
            '신고 처리가 정상적으로 접수되었습니다.',
            'notice',
            productId
        );

        res.json({ success: true, message: '신고가 접수되었습니다.' });

    } catch (err) {
        await conn.rollback();
        // 중복 신고 방지
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