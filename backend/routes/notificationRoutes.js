const express = require('express');
const router = express.Router();
const db = require('../db');

// 특정 유저 알림 모두 읽음 처리
router.patch('/user/:userId/read-all', (req, res) => {
  const { userId } = req.params;

  const sql = `
        UPDATE notifications
        SET is_read = 1
        WHERE user_id = ?
    `;

  db.query(sql, [userId], (err) => {
    if (err) {
      console.error('모두 읽음 처리 에러:', err);
      return res.status(500).json({ message: '모두 읽음 처리 실패' });
    }

    res.json({ message: '모두 읽음 처리 완료' });
  });
});

// 내 알림 목록 조회
router.get('/:userId', (req, res) => {
  const { userId } = req.params;

  const sql = `
        SELECT *
        FROM notifications
        WHERE user_id = ?
        ORDER BY created_at DESC
    `;

  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.error('알림 조회 에러:', err);
      return res.status(500).json({ message: '알림 조회 실패' });
    }

    res.json(results);
  });
});

// 알림 읽음 처리
router.patch('/:id/read', (req, res) => {
  const { id } = req.params;

  const sql = `
        UPDATE notifications
        SET is_read = 1
        WHERE id = ?
    `;

  db.query(sql, [id], (err) => {
    if (err) {
      console.error('알림 읽음 처리 에러:', err);
      return res.status(500).json({ message: '읽음 처리 실패' });
    }

    res.json({ message: '읽음 처리 완료' });
  });
});

// 테스트용 알림 생성
router.post('/', (req, res) => {
  const { user_id, title, message, type } = req.body;

  const sql = `
        INSERT INTO notifications (user_id, title, message, type)
        VALUES (?, ?, ?, ?)
    `;

  db.query(sql, [user_id, title, message, type || 'info'], (err, result) => {
    if (err) {
      console.error('알림 생성 에러:', err);
      return res.status(500).json({ message: '알림 생성 실패' });
    }

    res.json({ message: '알림 생성 완료', notificationId: result.insertId });
  });
});

module.exports = router;