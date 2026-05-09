const express = require('express');
const router = express.Router();
const db = require('../db');

// 상품 목록 조회 + 작성자 닉네임 포함
router.get('/', (req, res) => {
    const sql = `
        SELECT 
            products.*,
            users.nickname AS writer
        FROM products
        LEFT JOIN users ON products.user_id = users.id
        ORDER BY products.id DESC
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ error: '상품 조회 실패' });
        }

        res.json(results);
    });
});

// 상품 상세 조회 + 작성자 닉네임 포함
router.get('/:id', (req, res) => {
    const productId = req.params.id;

    const sql = `
        SELECT 
            products.*,
            users.nickname AS writer
        FROM products
        LEFT JOIN users ON products.user_id = users.id
        WHERE products.id = ?
    `;

    db.query(sql, [productId], (err, results) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ error: '상품 상세 조회 실패' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: '상품을 찾을 수 없습니다.' });
        }

        res.json(results[0]);
    });
});

// 상품 등록 + user_id 저장
router.post('/', (req, res) => {
    const {
        title,
        category,
        targetCount,
        price,
        duration,
        location,
        imageUrl,
        chatUrl,
        description,
        user_id
    } = req.body;

    const sql = `
        INSERT INTO products
        (title, category, targetCount, price, duration, location, imageUrl, chatUrl, description, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [
            title,
            category,
            targetCount,
            price,
            duration,
            location,
            imageUrl,
            chatUrl,
            description,
            user_id
        ],
        (err, result) => {
            if (err) {
                console.log(err);
                return res.status(500).json({ error: '상품 등록 실패' });
            }

            res.json({
                message: '상품 등록 성공',
                productId: result.insertId
            });
        }
    );
});

module.exports = router;