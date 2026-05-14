const getNow = () => Math.floor(Date.now() / 1000);

function parseDuration(duration) {
    if (!duration) return null;

    if (!isNaN(Number(duration))) {
        return Number(duration);
    }

    const num = parseInt(duration);
    if (Number.isNaN(num)) return null;

    if (duration.includes('분')) {
        return getNow() + num * 60;
    }

    if (duration.includes('시간')) {
        return getNow() + num * 3600;
    }

    if (duration.includes('일')) {
        return getNow() + num * 86400;
    }

    if (duration.includes('개월')) {
        return getNow() + num * 30 * 86400;
    }

    return null;
}
const express = require('express');
const router = express.Router();
const db = require('../db');
const createNotification = require('../utils/createNotification');

// productRoutes.js
// productRoutes.js 의 상품 목록 조회 (GET /)
router.get('/', (req, res) => {
    const { search, hideClosed } = req.query; // 🔍 검색어 및 체크박스 상태 받기
    const now = getNow();
    
    let sql = `
        SELECT
            products.*,
            users.nickname AS writer
        FROM products
        LEFT JOIN users ON products.user_id = users.id
        WHERE 1=1
    `;
    const params = [];

    // 검색어 필터
    if (search) {
        sql += ` AND products.title LIKE ?`; 
        params.push(`%${search}%`);
    }

    if (hideClosed === 'true') {
        sql += ` AND products.duration > ?`;
        params.push(now);
        sql += ` AND products.currentCount < products.targetCount`;
    }

    sql += ` ORDER BY products.id DESC`;

    db.query(sql, params, (err, results) => {
        if (err) return res.status(500).json({ error: '상품 조회 실패' });
        
        const updatedResults = results.map(product => ({
            ...product,
            isClosed: now > Number(product.duration) || product.currentCount >= product.targetCount
        }));
        res.json(updatedResults);
    });
});

// 2. 상품 상세 조회
router.get('/:id', (req, res) => {
    const productId = req.params.id;
    const sql = `
        SELECT products.*, users.nickname AS writer, users.trust_score AS writer_trust_score
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
        location, imageUrl, productUrl, description, user_id,
        shipping_fee, price_type
    } = req.body;


let durationNum = null;

if (
    duration !== undefined &&
    duration !== null &&
    duration !== '' &&
    duration !== 'NaN'
) {
    durationNum = parseDuration(duration);
}

if (durationNum !== null && Number.isNaN(durationNum)) {
    return res.status(400).json({
        error: 'duration 값이 올바르지 않습니다.'
    });
}

    const sql = `
        INSERT INTO products
        (title, category, targetCount, price, duration, location, imageUrl, productUrl, description, user_id, shipping_fee, price_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(sql,
        [title, category, targetCount, price, durationNum, location, imageUrl, productUrl, description, user_id, shipping_fee || 0, price_type || 'per'],
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
router.put('/:id', async (req, res) => {
    const productId = req.params.id;

    const {
        title,
        category,
        targetCount,
        price,
        duration,
        location,
        imageUrl,
        productUrl,
        description,
        shipping_fee,
        price_type
    } = req.body;

    try {
        const [rows] = await db.promise().query(
            'SELECT currentCount, targetCount, duration FROM products WHERE id = ?',
            [productId]
        );
        if (rows.length === 0) return res.status(404).json({ error: '상품을 찾을 수 없습니다.' });
        const p = rows[0];
        const nowSec = Math.floor(Date.now() / 1000);
        if (p.currentCount >= p.targetCount || Number(p.duration) <= nowSec) {
            return res.status(403).json({ error: '이미 마감된 공고는 수정할 수 없습니다.' });
        }
    } catch (e) {
        console.error('수정 전 마감 체크 실패:', e);
        return res.status(500).json({ error: '서버 에러' });
    }

    let durationNum = null;

    if (
        duration !== undefined &&
        duration !== null &&
        duration !== '' &&
        duration !== 'NaN'
    ) {
durationNum = parseDuration(duration);
    }

    const sql = `
        UPDATE products
        SET title = ?,
            category = ?,
            targetCount = ?,
            price = ?,
            duration = ?,
            location = ?,
            imageUrl = ?,
            productUrl = ?,
            description = ?,
            shipping_fee = ?,
            price_type = ?
        WHERE id = ?
    `;

    db.query(
        sql,
        [
            title,
            category,
            targetCount,
            price,
            durationNum,
            location,
            imageUrl,
            productUrl,
            description,
            shipping_fee || 0,
            price_type || 'per',
            productId
        ],
        (err, result) => {
            if (err) {
                console.error('상품 수정 SQL 에러:', err);

                return res.status(500).json({
                    error: '수정 실패',
                    detail: err.message
                });
            }

            (async () => {
                const [participants] = await db.promise().query(
                    `SELECT user_id FROM product_participants WHERE product_id = ? AND status NOT IN ('cancelled', 'noshow')`,
                    [productId]
                );
                participants.forEach(p => {
                    createNotification(p.user_id, '공구 정보 수정', `"${title}" 공구의 공구 정보가 수정되었습니다.`, 'notice');
                });
            })().catch(e => console.error('수정 알림 실패:', e));

            res.json({ message: '상품 수정 성공' });
        }
    );
});
// 5. 상품 삭제
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [[product]] = await db.promise().query(`SELECT title FROM products WHERE id = ?`, [id]);
        if (product) {
            const [participants] = await db.promise().query(
                `SELECT user_id FROM product_participants WHERE product_id = ? AND status NOT IN ('cancelled', 'noshow')`,
                [id]
            );
            participants.forEach(p => {
                createNotification(p.user_id, '공구 삭제 안내', `참여 중인 "${product.title}" 공구가 삭제되었습니다.`, 'notice');
            });
        }
        await db.promise().query(`DELETE FROM products WHERE id = ?`, [id]);
        res.json({ message: '삭제 완료' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '삭제 실패' });
    }
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

// 7. 상품 조기 마감 (Early Close)
router.patch('/early-close', async (req, res) => {
    const { productId } = req.body;

    if (!productId) {
        return res.status(400).json({ error: '상품 ID가 필요합니다.' });
    }

    const now = getNow();

    try {
        const [result] = await db.promise().query(
            `UPDATE products SET duration = ? WHERE id = ?`,
            [now, productId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: '해당 공구방을 찾을 수 없습니다.' });
        }

        // 상품 정보 조회
        const [[product]] = await db.promise().query(
            `SELECT title, user_id FROM products WHERE id = ?`,
            [productId]
        );

        // 참여자 조회 (취소·노쇼 제외)
        const [participants] = await db.promise().query(
            `SELECT user_id FROM product_participants WHERE product_id = ? AND status NOT IN ('cancelled', 'noshow')`,
            [productId]
        );

        // 참여자 전원에게 알림 (방장 포함)
        const msg = `"${product.title}" 공구가 조기 마감되었습니다.`;
        createNotification(product.user_id, '공구 조기 마감', msg, 'notice', productId);
        participants.forEach(p => {
            if (String(p.user_id) !== String(product.user_id)) {
                createNotification(p.user_id, '공구 조기 마감', msg, 'notice', productId);
            }
        });

        res.json({ message: '성공적으로 조기 마감되었습니다.' });
    } catch (err) {
        console.error('조기 마감 처리 중 에러 발생:', err);
        res.status(500).json({ error: '마감 처리에 실패했습니다.', detail: err.message });
    }
});

module.exports = router;

