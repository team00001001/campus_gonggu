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

// 상품 수정 (PUT 요청 처리)
router.put('/:id', (req, res) => {
    const productId = req.params.id;
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

    // 데이터베이스의 정보를 업데이트하는 SQL 문법입니다.
    const sql = `
        UPDATE products 
        SET title = ?, 
            category = ?, 
            targetCount = ?, 
            price = ?, 
            duration = ?, 
            location = ?, 
            imageUrl = ?, 
            chatUrl = ?, 
            description = ? 
        WHERE id = ?
    `;

    db.query(
        sql,
        [title, category, targetCount, price, duration, location, imageUrl, chatUrl, description, productId],
        (err, result) => {
            if (err) {
                console.error('DB 수정 에러:', err);
                return res.status(500).json({ error: '데이터베이스 수정 실패' });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: '수정할 상품을 찾을 수 없습니다.' });
            }

            res.json({ message: '상품 수정 성공' });
        }
    );
});
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await db.promise().query(
            'DELETE FROM products WHERE id = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: '공고를 찾을 수 없습니다.' });
        }

        res.json({ message: '공고 삭제 완료' });

    } catch (error) {
        console.error('공고 삭제 실패:', error);
        res.status(500).json({ message: '공고 삭제 실패' });
    }
});
module.exports = router;