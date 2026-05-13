const db = require('../db');

function createNotification(userId, title, message, type = 'info', productId = null) {
    console.log('createNotification 실행됨:', userId, title);

    const sql = `
        INSERT INTO notifications (user_id, title, message, type, product_id)
        VALUES (?, ?, ?, ?, ?)
    `;

    db.query(sql, [userId, title, message, type, productId || null], (err, result) => {
        if (err) {
            console.error('알림 생성 실패:', err);
            return;
        }

        console.log('알림 생성 성공:', result.insertId);
    });
}

module.exports = createNotification;