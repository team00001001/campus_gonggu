const express = require('express');
const router = express.Router();
const pool = require('../db');
router.get('/my/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        const [rows] = await pool.promise().query(
            `
            SELECT
    p.id AS product_id,
    p.title,
    p.category,
    p.location,
    p.price,
    p.imageUrl,
    p.currentCount,
    p.targetCount,
    pp.created_at AS joined_at
            FROM product_participants pp
            JOIN products p ON pp.product_id = p.id
            WHERE pp.user_id = ?
              AND pp.status = 'joined'
            ORDER BY pp.created_at DESC
            `,
            [userId]
        );

        res.json(rows);
    } catch (error) {
        console.error('내 채팅방 목록 조회 실패:', error);
        res.status(500).json({ message: '내 채팅방 목록 조회 실패' });
    }
});
// 특정 공구방 채팅 불러오기
router.get('/:productId', async (req, res) => {
    const { productId } = req.params;

    try {
        const [rows] = await pool.promise().query(
            `
            SELECT 
                cm.id,
                cm.product_id,
                cm.user_id,
                cm.message,
                cm.created_at,
                u.nickname
            FROM chat_messages cm
            JOIN users u ON cm.user_id = u.id
            WHERE cm.product_id = ?
            ORDER BY cm.created_at ASC
            `,
            [productId]
        );

        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '채팅 불러오기 실패' });
    }
});

// 메시지 보내기
router.post('/', async (req, res) => {
    const { productId, userId, message } = req.body;

    if (!productId || !userId || !message) {
        return res.status(400).json({ message: '필수 정보가 없습니다.' });
    }

    try {
        await pool.promise().query(
            `
            INSERT INTO chat_messages (product_id, user_id, message)
            VALUES (?, ?, ?)
            `,
            [productId, userId, message]
        );

        res.status(201).json({ message: '메시지 전송 완료' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '메시지 전송 실패' });
    }
});

module.exports = router;