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
        location, imageUrl, productUrl, description, user_id
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
        (title, category, targetCount, price, duration, location, imageUrl, productUrl, description, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(sql,
        [title, category, targetCount, price, durationNum, location, imageUrl, productUrl, description, user_id],
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

    const {
        title,
        category,
        targetCount,
        price,
        duration,
        location,
        imageUrl,
        productUrl,
        description
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
            description = ?
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
router.patch('/early-close', (req, res) => {
    const { productId } = req.body;

    if (!productId) {
        return res.status(400).json({ error: '상품 ID가 필요합니다.' });
    }

    const now = getNow(); // 상단에 정의된 현재 시간 계산 함수

    // duration(마감 기한)을 현재 시간으로 변경하여 즉시 마감 처리
    const sql = `UPDATE products SET duration = ? WHERE id = ?`;
    
    db.query(sql, [now, productId], (err, result) => {
        if (err) {
            console.error('조기 마감 처리 중 에러 발생:', err);
            return res.status(500).json({ error: '마감 처리에 실패했습니다.', detail: err.message });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: '해당 공구방을 찾을 수 없습니다.' });
        }

        res.json({ message: '성공적으로 조기 마감되었습니다.' });
    });
});

module.exports = router;

