require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const createNotification = require('./utils/createNotification');
const productRoutes = require('./routes/productRoutes');
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/auth');
const participantRoutes = require('./routes/participantRoutes');
const chatRoutes = require('./routes/chatRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');
const pool = require('./db');
const reportRoutes = require('./routes/reportRoutes');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});
const notificationRoutes = require('./routes/notificationRoutes');
const reviewRoutes = require('./routes/reviewRoutes');

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

app.use('/notifications', notificationRoutes);

app.use('/products', productRoutes);
app.use('/users', userRoutes);
app.use('/api', authRoutes);
app.use('/participants', participantRoutes);
app.use('/chats', chatRoutes);
app.use('/delivery', deliveryRoutes);
app.use('/reports', reportRoutes);
app.use('/reviews', reviewRoutes);

io.on('connection', (socket) => {
    console.log('채팅 접속:', socket.id);

    socket.on('joinRoom', (productId) => {
        socket.join(`room-${productId}`);
        console.log(`${socket.id} joined room-${productId}`);
    });

    socket.on('sendMessage', async (data) => {

        console.log('소켓 채팅 메시지 들어옴:', data);
        const { productId, userId, message } = data;

        if (!productId || !userId || !message) return;

        try {
            await pool.promise().query(
                `
                INSERT INTO chat_messages (product_id, user_id, message)
                VALUES (?, ?, ?)
                `,
                [productId, userId, message]
            );

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
                ORDER BY cm.created_at DESC
                LIMIT 1
                `,
                [productId]
            );
            // 채팅 알림 생성: 보낸 사람 제외, 같은 공구 참여자에게 알림
            const [[product]] = await pool.promise().query(
                `
    SELECT title
    FROM products
    WHERE id = ?
    `,
                [productId]
            );

            const [participants] = await pool.promise().query(
                `
    SELECT user_id
    FROM product_participants
    WHERE product_id = ?
    AND status = 'joined'
    AND user_id != ?
    `,
                [productId, userId]
            );

            participants.forEach(p => {
                createNotification(
                    p.user_id,
                    '새 채팅 메시지',
                    `"${product.title}" 채팅방에 새 메시지가 도착했습니다.`,
                    'chat'
                );
            });
            io.to(`room-${productId}`).emit('newMessage', rows[0]);

        } catch (error) {
            console.error('실시간 메시지 저장 실패:', error);
        }
    });
});

// 서버 시작 시 필요한 컬럼 추가 (없을 경우에만)
async function addColumnIfNotExists(columnName) {
    const [rows] = await pool.promise().query(
        `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = ?`,
        [columnName]
    );
    if (rows[0].cnt === 0) {
        await pool.promise().query(
            `ALTER TABLE products ADD COLUMN ${columnName} TINYINT(1) NOT NULL DEFAULT 0`
        );
        console.log(`${columnName} 컬럼 추가 완료`);
    }
}

addColumnIfNotExists('closing_notified').catch(err => console.error('closing_notified 컬럼 추가 실패:', err));

// 가격 구조 컬럼 추가
(async () => {
    try {
        const [r1] = await pool.promise().query(
            `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'shipping_fee'`
        );
        if (r1[0].cnt === 0) {
            await pool.promise().query(`ALTER TABLE products ADD COLUMN shipping_fee INT NOT NULL DEFAULT 0`);
            console.log('shipping_fee 컬럼 추가 완료');
        }
        const [r2] = await pool.promise().query(
            `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'price_type'`
        );
        if (r2[0].cnt === 0) {
            await pool.promise().query(`ALTER TABLE products ADD COLUMN price_type VARCHAR(10) NOT NULL DEFAULT 'per'`);
            console.log('price_type 컬럼 추가 완료');
        }
    } catch (err) {
        console.error('가격 구조 컬럼 추가 실패:', err);
    }
})();

// reviews 테이블 생성
(async () => {
    try {
        await pool.promise().query(`
            CREATE TABLE IF NOT EXISTS reviews (
                id INT AUTO_INCREMENT PRIMARY KEY,
                product_id INT NOT NULL,
                reviewer_id INT NOT NULL,
                host_id INT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_review (product_id, reviewer_id)
            )
        `);
        console.log('reviews 테이블 확인/생성 완료');
    } catch (err) {
        console.error('reviews 테이블 생성 실패:', err);
    }
})();
addColumnIfNotExists('transaction_notified').catch(err => console.error('transaction_notified 컬럼 추가 실패:', err));

// 배송 조회 결과 캐시 컬럼 추가
(async () => {
    try {
        const [r1] = await pool.promise().query(
            `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'tracking_result'`
        );
        if (r1[0].cnt === 0) {
            await pool.promise().query(`ALTER TABLE products ADD COLUMN tracking_result LONGTEXT NULL`);
            console.log('tracking_result 컬럼 추가 완료');
        }
        const [r2] = await pool.promise().query(
            `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'tracking_cached_at'`
        );
        if (r2[0].cnt === 0) {
            await pool.promise().query(`ALTER TABLE products ADD COLUMN tracking_cached_at BIGINT NULL`);
            console.log('tracking_cached_at 컬럼 추가 완료');
        }
    } catch (err) {
        console.error('배송 캐시 컬럼 추가 실패:', err);
    }
})();

// 5분마다 공구 상태 체크
setInterval(async () => {
    try {
        const now = Math.floor(Date.now() / 1000);
        const oneHourLater = now + 3600;

        // ① 마감 1시간 이내 공구 → "곧 마감됩니다" 알림
        const [closingProducts] = await pool.promise().query(`
            SELECT id, title, user_id
            FROM products
            WHERE duration > ?
            AND duration <= ?
            AND closing_notified = 0
            AND status != 'success'
        `, [now, oneHourLater]);

        for (const product of closingProducts) {
            const [participants] = await pool.promise().query(`
                SELECT user_id FROM product_participants
                WHERE product_id = ? AND status NOT IN ('cancelled', 'noshow')
            `, [product.id]);

            const msg = `"${product.title}" 공구가 곧 마감됩니다.`;
            createNotification(product.user_id, '공구 마감 임박', msg, 'notice');
            for (const p of participants) {
                if (String(p.user_id) !== String(product.user_id)) {
                    createNotification(p.user_id, '공구 마감 임박', msg, 'notice');
                }
            }

            await pool.promise().query(
                `UPDATE products SET closing_notified = 1 WHERE id = ?`,
                [product.id]
            );
            console.log(`마감 임박 알림 전송: 공구 ID ${product.id} "${product.title}"`);
        }

        // ② 마감됐지만 거래 완료 미확인 공구 → "거래 완료 확인 필요" 알림
        const [expiredProducts] = await pool.promise().query(`
            SELECT id, title, user_id
            FROM products
            WHERE duration <= ?
            AND status != 'success'
            AND transaction_notified = 0
        `, [now]);

        for (const product of expiredProducts) {
            const [participants] = await pool.promise().query(`
                SELECT user_id FROM product_participants
                WHERE product_id = ? AND status NOT IN ('cancelled', 'noshow')
            `, [product.id]);

            if (participants.length === 0) {
                await pool.promise().query(
                    `UPDATE products SET transaction_notified = 1 WHERE id = ?`,
                    [product.id]
                );
                continue;
            }

            const msg = `공구 마감 후 거래 완료 확인이 필요합니다.`;
            createNotification(product.user_id, '거래 완료 확인 필요', msg, 'notice', product.id);
            for (const p of participants) {
                if (String(p.user_id) !== String(product.user_id)) {
                    createNotification(p.user_id, '거래 완료 확인 필요', msg, 'notice', product.id);
                }
            }

            await pool.promise().query(
                `UPDATE products SET transaction_notified = 1 WHERE id = ?`,
                [product.id]
            );
            console.log(`거래 완료 확인 알림 전송: 공구 ID ${product.id} "${product.title}"`);
        }
    } catch (err) {
        console.error('공구 스케줄러 오류:', err);
    }
}, 5 * 60 * 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`서버 실행 중: http://localhost:${PORT}`);
});