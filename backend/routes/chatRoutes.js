const express = require('express');
const router = express.Router();
const pool = require('../db');
const createNotification = require('../utils/createNotification');

// 1. 내 채팅방 목록 조회 (수정됨)
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
            -- 노쇼, 취소된 사람만 빼고 모두 채팅방 보이게 수정!
            AND pp.status IN ('joined', 'confirmed', 'completed')
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

// 2. 특정 공구방 채팅 불러오기
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

// 3. 메시지 보내기 및 알림 처리 (수정됨)
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

        // 공구 제목 + 방장 조회
        const [[product]] = await pool.promise().query(
            `
            SELECT title, user_id AS owner_id
            FROM products
            WHERE id = ?
            `,
            [productId]
        );
        const [[sender]] = await pool.promise().query(
            `
            SELECT nickname
            FROM users
            WHERE id = ?
            `,
            [userId]
        );
        // 참여자 조회 (알림 받을 사람 목록 - 수정됨)
        const [participants] = await pool.promise().query(
            `
            SELECT user_id
            FROM product_participants
            WHERE product_id = ?
            -- 확정되거나 완료된 사람에게도 채팅 알림이 가도록 수정!
            AND status IN ('joined', 'confirmed', 'completed')
            AND user_id != ?
            `,
            [productId, userId]
        );

        // 알림 받을 사람 목록
        const receiverIds = new Set();

        // 참여자 추가
        participants.forEach(p => {
            receiverIds.add(Number(p.user_id));
        });

        // 방장 추가 (보낸 사람 제외)
        if (product && Number(product.owner_id) !== Number(userId)) {
            receiverIds.add(Number(product.owner_id));
        }

        receiverIds.forEach(receiverId => {
            createNotification(
                receiverId,
                '새 채팅 메시지',
                `<b>${sender.nickname}</b>님이 "${product.title}" 채팅방에 메시지를 남겼습니다.`,
                'chat',
                productId
            );
        });

        res.status(201).json({ message: '메시지 전송 완료' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '메시지 전송 실패' });
    }
});

module.exports = router;