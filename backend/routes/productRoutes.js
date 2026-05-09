const express = require('express');
const router = express.Router();
const db = require('../db');

// 상품 목록 조회
router.get('/', (req, res) => {

    const sql = 'SELECT * FROM products ORDER BY id DESC';

    db.query(sql, (err, results) => {

        if (err) {
            console.log(err);
            return res.status(500).json({ error: '상품 조회 실패' });
        }

        res.json(results);
    });
});
// 상품 상세 조회
router.get('/:id', (req, res) => {
    const productId = req.params.id;

    const sql = 'SELECT * FROM products WHERE id = ?';

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

// 상품 등록
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
    description
    } = req.body;

    const sql = `
    INSERT INTO products
    (title, category, targetCount, price, duration, location, imageUrl, chatUrl, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            description
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