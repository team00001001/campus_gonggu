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

app.use(cors());
app.use(express.json());

app.use('/notifications', notificationRoutes);

app.use('/products', productRoutes);
app.use('/users', userRoutes);
app.use('/api', authRoutes);
app.use('/participants', participantRoutes);
app.use('/chats', chatRoutes);
app.use('/delivery', deliveryRoutes);
app.use('/reports', reportRoutes);

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

server.listen(3000, '0.0.0.0', () => {
    console.log('서버 실행 중: http://localhost:3000');
});