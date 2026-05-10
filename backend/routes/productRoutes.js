const express = require('express');
const router = express.Router();
const db = require('../db');

// 현재 시간을 초 단위로 (Unix Timestamp)
const getNow = () => Math.floor(Date.now() / 1000);

// 1. 상품 목록 조회
router.get('/', (req, res) => {
    const sql = `
        SELECT products.*, users.nickname AS writer
        FROM products
        LEFT JOIN users ON products.user_id = users.id
        ORDER BY products.id DESC
    `;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: '상품 조회 실패' });

        const now = getNow();
        const updatedResults = results.map(product => ({
            ...product,
            // duration이 숫자형인지 확인하고 마감 여부 결정
            isClosed: now > Number(product.duration)
        }));
        res.json(updatedResults);
    });
});

// 2. 상품 상세 조회
router.get('/:id', (req, res) => {
    const productId = req.params.id;
    const sql = `
        SELECT products.*, users.nickname AS writer
        FROM products
        LEFT JOIN users ON products.user_id = users.id
        WHERE products.id = ?
    `;
    db.query(sql, [productId], (err, results) => {
        if (err) return res.status(500).json({ error: '상품 상세 조회 실패' });
        if (results.length === 0) return res.status(404).json({ error: '상품 없음' });

        const product = results[0];
        res.json({
            ...product,
            isClosed: getNow() > Number(product.duration)
        });
    });
});

// 3. 상품 등록 (가장 많이 바뀐 부분!)
router.post('/', (req, res) => {
    const {
        title, category, targetCount, price, duration,
        location, imageUrl, chatUrl, description, user_id
    } = req.body;

    // [수정] 프론트에서 이미 계산된 마감 시각(숫자)을 보내주므로 
    // 백엔드에서는 숫자형으로 변환만 해서 바로 저장합니다.
    const durationNum = Number(duration);

    const sql = `
        INSERT INTO products
        (title, category, targetCount, price, duration, location, imageUrl, chatUrl, description, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, 
        [title, category, targetCount, price, durationNum, location, imageUrl, chatUrl, description, user_id], 
        (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: '상품 등록 실패' });
            }
            res.json({ message: '상품 등록 성공', productId: result.insertId });
        }
    );
});

// 4. 상품 수정
router.put('/:id', (req, res) => {
    const productId = req.params.id;
    const { title, category, targetCount, price, duration, location, imageUrl, chatUrl, description } = req.body;

    // 수정 시에도 duration을 숫자로 변환
    const durationNum = Number(duration);

    const sql = `
        UPDATE products 
        SET title = ?, category = ?, targetCount = ?, price = ?, duration = ?, 
            location = ?, imageUrl = ?, chatUrl = ?, description = ? 
        WHERE id = ?
    `;

    db.query(sql, 
        [title, category, targetCount, price, durationNum, location, imageUrl, chatUrl, description, productId], 
        (err, result) => {
            if (err) return res.status(500).json({ error: '수정 실패' });
            res.json({ message: '상품 수정 성공' });
        }
    );
});

// 5. 상품 삭제 (promise 지원 안 할 경우를 대비해 일반 쿼리 권장)
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    db.query('DELETE FROM products WHERE id = ?', [id], (err, result) => {
        if (err) return res.status(500).json({ error: '삭제 실패' });
        res.json({ message: '삭제 완료' });
    });
});

// 6. 마감 기한 단축
router.patch('/:id/reduce', (req, res) => {
    const productId = req.params.id;
    const REDUCE_SEC = 3600; 
    const sql = `UPDATE products SET duration = duration - ? WHERE id = ?`;
    db.query(sql, [REDUCE_SEC, productId], (err, result) => {
        if (err) return res.status(500).json({ error: '단축 실패' });
        res.json({ message: '1시간 단축 완료' });
    });
});

module.exports = router;