const express = require('express');
const router = express.Router();
const pool = require('../db');

// 크림슨 지수 계산 공통 함수 (최소 -100, 최대 100 제한)
async function updateTrustScore(userId, delta, conn) {
    await conn.query(`
        UPDATE users
        SET trust_score = LEAST(100, GREATEST(-100, trust_score + ?))
        WHERE id = ?
    `, [delta, userId]);
}

router.post('/join', async (req, res) => {
    const { productId, userId } = req.body;

    if (!productId || !userId) {
        return res.status(400).json({ message: 'productId 또는 userId가 없습니다.' });
    }

    const conn = await pool.promise().getConnection();

    try {
        await conn.beginTransaction();

        const [products] = await conn.query(
            'SELECT currentCount, targetCount FROM products WHERE id = ? FOR UPDATE',
            [productId]
        );

        if (products.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: '공구방을 찾을 수 없습니다.' });
        }

        const product = products[0];

        if (product.currentCount >= product.targetCount) {
            await conn.rollback();
            return res.status(400).json({ message: '이미 모집이 마감된 공구입니다.' });
        }

        const [existing] = await conn.query(
            `
            SELECT status
            FROM product_participants
            WHERE product_id = ? AND user_id = ?
            FOR UPDATE
            `,
            [productId, userId]
        );

        if (existing.length > 0) {
            const status = existing[0].status;

            if (status === 'joined') {
                await conn.rollback();
                return res.status(409).json({ message: '이미 참여한 공구입니다.' });
            }

            if (status === 'cancelled') {
                await conn.query(
                    `
                    UPDATE product_participants
                    SET status = 'joined',
                        created_at = CURRENT_TIMESTAMP
                    WHERE product_id = ? AND user_id = ?
                    `,
                    [productId, userId]
                );

                await conn.query(
                    'UPDATE products SET currentCount = currentCount + 1 WHERE id = ?',
                    [productId]
                );

                await conn.commit();
                return res.status(200).json({ message: '공구 재참여 완료' });
            }
        }

        await conn.query(
            `
            INSERT INTO product_participants (product_id, user_id, status)
            VALUES (?, ?, 'joined')
            `,
            [productId, userId]
        );

        await conn.query(
            'UPDATE products SET currentCount = currentCount + 1 WHERE id = ?',
            [productId]
        );

        await conn.commit();

        res.status(201).json({ message: '공구 참여 완료' });

    } catch (error) {
        await conn.rollback();
        console.error(error);
        res.status(500).json({ message: '공구 참여 실패' });
    } finally {
        conn.release();
    }
});

router.patch('/cancel', async (req, res) => {
    const { productId, userId } = req.body;

    if (!productId || !userId) {
        return res.status(400).json({ message: 'productId 또는 userId가 없습니다.' });
    }

    const conn = await pool.promise().getConnection();

    try {
        await conn.beginTransaction();

        const [rows] = await conn.query(
            `
            SELECT *
            FROM product_participants
            WHERE product_id = ?
            AND user_id = ?
            AND status = 'joined'
            `,
            [productId, userId]
        );

        if (rows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: '참여 내역이 없습니다.' });
        }

        await conn.query(
            `
            UPDATE product_participants
            SET status = 'cancelled'
            WHERE product_id = ?
            AND user_id = ?
            `,
            [productId, userId]
        );

        await conn.query(
            `
            UPDATE products
            SET currentCount = GREATEST(currentCount - 1, 0)
            WHERE id = ?
            `,
            [productId]
        );

        await conn.commit();

        res.json({ message: '참여 취소 완료' });

    } catch (error) {
        await conn.rollback();
        console.error(error);
        res.status(500).json({ message: '참여 취소 실패' });
    } finally {
        conn.release();
    }
});
router.get('/', async (req, res) => {
    const { productId } = req.query;

    if (!productId) {
        return res.status(400).json({
            message: 'productId가 필요합니다.'
        });
    }

    try {
        const [rows] = await pool.promise().query(
            `
            SELECT
                pp.id AS participant_id,
                pp.product_id,
                pp.user_id,
                pp.status,
                pp.created_at,
                u.nickname,
                u.email,
                u.trust_score
            FROM product_participants pp
            JOIN users u ON pp.user_id = u.id
            WHERE pp.product_id = ?
            AND pp.status = 'joined'
            ORDER BY pp.created_at ASC
            `,
            [productId]
        );

        res.json(rows);

    } catch (error) {
        console.error('참여자 조회 실패:', error);
        res.status(500).json({
            message: '참여자 조회 실패'
        });
    }
});

// 방장이 참여자의 상태(노쇼/확인)를 업데이트하는 API
router.patch('/status', async (req, res) => {
    const { participantId, userId, status } = req.body; 

    const conn = await pool.promise().getConnection();
    try {
        await conn.beginTransaction();

        // 1. 참여자 상태 업데이트 (success 대신 confirmed/noshow 저장)
        await conn.query(
            `UPDATE product_participants SET status = ? WHERE id = ?`,
            [status, participantId]
        );

        // 2. 유저 신뢰도 점수 업데이트 (노쇼면 -15점, 성공(confirmed)이면 +3점)
        let scoreChange = status === 'noshow' ? -15 : 3;
        
        // 공통 함수 사용 (자동으로 100/-100 제한 걸림)
        await updateTrustScore(userId, scoreChange, conn);

        await conn.commit();
        res.json({ message: '상태 업데이트 및 점수 반영 완료' });

    } catch (error) {
        await conn.rollback();
        console.error(error);
        res.status(500).json({ message: '상태 업데이트 실패' });
    } finally {
        conn.release();
    }
});

// [API] 참여자 -> 수령 완료 확인 (과반수 체크 및 방장/참여자 점수 보상)
router.patch('/receive', async (req, res) => {
    const { productId, userId } = req.body;
    const conn = await pool.promise().getConnection();

    try {
        await conn.beginTransaction();

        // 1. 참여자 본인 수령 완료 처리
        await conn.query(`
            UPDATE product_participants
            SET is_received = 1, status = 'completed'
            WHERE product_id = ? AND user_id = ?
        `, [productId, userId]);

        // 2. 전체 유효 참여자 수
        const [[totalRow]] = await conn.query(`
            SELECT COUNT(*) AS cnt FROM product_participants
            WHERE product_id = ? AND status IN ('confirmed', 'completed')
        `, [productId]);
        const total = totalRow.cnt;

        // 3. 수령 완료 누른 사람 수
        const [[receivedRow]] = await conn.query(`
            SELECT COUNT(*) AS cnt FROM product_participants
            WHERE product_id = ? AND is_received = 1
        `, [productId]);
        const received = receivedRow.cnt;

        // 4. 과반수 계산
        let threshold = total >= 4 ? Math.floor(total / 2) + 1 : total;
        let isSuccess = false;

        // 5. 조건 충족 시 점수 보상 지급
        if (received >= threshold) {
            isSuccess = true;
            
            const [[product]] = await conn.query(`
                SELECT user_id, trust_rewarded FROM products WHERE id = ?
            `, [productId]);

            // 중복 지급 방지
            if (product && product.trust_rewarded === 0) {
                // 방장 점수 부여 (+10)
                await updateTrustScore(product.user_id, 10, conn);

                // 유효 참여자들 점수 부여 (+2)
                await conn.query(`
                    UPDATE users
                    SET trust_score = LEAST(100, trust_score + 2)
                    WHERE id IN (
                        SELECT user_id FROM product_participants
                        WHERE product_id = ? AND status IN ('confirmed', 'completed')
                    )
                `, [productId]);

                // 보상 완료 마킹
                await conn.query(`
                    UPDATE products
                    SET status = 'completed', trust_rewarded = 1
                    WHERE id = ?
                `, [productId]);
            }
        }

        await conn.commit();
        res.json({ success: true, received, threshold, isSuccess });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).json({ message: '수령 확인 처리 실패' });
    } finally {
        conn.release();
    }
});

module.exports = router; //이 줄은 파일의 가장 마지막에 있어야 함