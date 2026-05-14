const express = require('express');
const router = express.Router();
const db = require('../db');

// POST /reviews - 후기 작성
router.post('/', async (req, res) => {
    const { productId, reviewerId, hostId, content } = req.body;
    if (!productId || !reviewerId || !hostId || !content?.trim()) {
        return res.status(400).json({ message: '필수 항목이 누락되었습니다.' });
    }
    try {
        const [participant] = await db.promise().query(
            `SELECT status FROM product_participants WHERE product_id = ? AND user_id = ? AND status = 'completed'`,
            [productId, reviewerId]
        );
        if (participant.length === 0) {
            return res.status(403).json({ message: '수령 완료한 참여자만 후기를 남길 수 있습니다.' });
        }

        const [existing] = await db.promise().query(
            `SELECT id FROM reviews WHERE product_id = ? AND reviewer_id = ?`,
            [productId, reviewerId]
        );
        if (existing.length > 0) {
            return res.status(409).json({ message: '이미 후기를 남기셨습니다.' });
        }

        await db.promise().query(
            `INSERT INTO reviews (product_id, reviewer_id, host_id, content) VALUES (?, ?, ?, ?)`,
            [productId, reviewerId, hostId, content.trim()]
        );

        // 방장 +1, 후기 작성자 +1
        await db.promise().query(
            `UPDATE users SET trust_score = trust_score + 1 WHERE id IN (?, ?)`,
            [hostId, reviewerId]
        );

        res.json({ message: '후기가 등록되었습니다.' });
    } catch (e) {
        console.error('후기 등록 실패:', e);
        res.status(500).json({ message: '서버 오류' });
    }
});

// GET /reviews/host/:hostId - 방장 후기 목록
router.get('/host/:hostId', async (req, res) => {
    const { hostId } = req.params;
    try {
        const [reviews] = await db.promise().query(
            `SELECT r.id, r.content, r.created_at,
                    u.nickname AS reviewer_nickname,
                    p.title AS product_title
             FROM reviews r
             JOIN users u ON r.reviewer_id = u.id
             JOIN products p ON r.product_id = p.id
             WHERE r.host_id = ?
             ORDER BY r.created_at DESC`,
            [hostId]
        );
        res.json(reviews);
    } catch (e) {
        console.error('후기 조회 실패:', e);
        res.status(500).json({ message: '서버 오류' });
    }
});

// GET /reviews/check/:productId/:reviewerId - 이미 후기 남겼는지 확인
router.get('/check/:productId/:reviewerId', async (req, res) => {
    const { productId, reviewerId } = req.params;
    try {
        const [existing] = await db.promise().query(
            `SELECT id FROM reviews WHERE product_id = ? AND reviewer_id = ?`,
            [productId, reviewerId]
        );
        res.json({ hasReviewed: existing.length > 0 });
    } catch (e) {
        res.status(500).json({ message: '서버 오류' });
    }
});

module.exports = router;
