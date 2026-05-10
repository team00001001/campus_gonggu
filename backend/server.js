require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const productRoutes = require('./routes/productRoutes');
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/auth');
const participantRoutes = require('./routes/participantRoutes');
const chatRoutes = require('./routes/chatRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes'); 
const pool = require('./db');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

app.use(cors());
app.use(express.json());

app.use('/products', productRoutes);
app.use('/users', userRoutes);
app.use('/api', authRoutes);
app.use('/participants', participantRoutes);
app.use('/chats', chatRoutes);
app.use('/delivery', deliveryRoutes);

io.on('connection', (socket) => {
    console.log('채팅 접속:', socket.id);

    socket.on('joinRoom', (productId) => {
        socket.join(`room-${productId}`);
        console.log(`${socket.id} joined room-${productId}`);
    });

    socket.on('sendMessage', async (data) => {
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

            io.to(`room-${productId}`).emit('newMessage', rows[0]);

        } catch (error) {
            console.error('실시간 메시지 저장 실패:', error);
        }
    });
});

server.listen(3000, '0.0.0.0', () => {
    console.log('서버 실행 중: http://localhost:3000');
});