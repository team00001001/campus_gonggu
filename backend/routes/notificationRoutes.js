const express = require('express');
const router = express.Router();
const db = require('../db');

// 1. 특정 유저 알림 모두 읽음 처리
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

// 2. 내 알림 목록 조회
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

// 3. 알림 읽음 처리
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

// 4. 알림 개별 삭제 처리
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  const sql = `
        DELETE FROM notifications
        WHERE id = ?
    `;

  db.query(sql, [id], (err) => {
    if (err) {
      console.error('알림 삭제 에러:', err);
      return res.status(500).json({ message: '알림 삭제 실패' });
    }

    res.json({ message: '알림 삭제 완료' });
  });
});

// 5. 💡 [새로 추가된 부분] 특정 유저 알림 모두 삭제 처리
router.delete('/user/:userId/delete-all', (req, res) => {
  const { userId } = req.params;

  const sql = `
        DELETE FROM notifications
        WHERE user_id = ?
    `;

  db.query(sql, [userId], (err) => {
    if (err) {
      console.error('알림 모두 삭제 처리 에러:', err);
      return res.status(500).json({ message: '알림 모두 삭제 처리 실패' });
    }

    res.json({ message: '알림 모두 삭제 처리 완료' });
  });
});

// 6. 알림 생성 (동적 메세지 처리)
router.post('/', (req, res) => {
  // 클라이언트 요청에서 product_name을 추가로 구조분해할당 받습니다.
  const { user_id, title, message, type, product_name } = req.body;

  let finalMessage = message; 

  // product_name이 존재할 경우 알림 메세지를 포맷팅합니다.
  if (product_name) {
    if (title === '거래 완료 확인 필요') {
      finalMessage = `"${product_name}" 공구의 거래 완료 확인이 필요합니다.`;
    } else if (title === '공구 마감') {
      finalMessage = `"${product_name}" 공구가 곧 마감됩니다.`;
    } else {
      finalMessage = `"${product_name}" 공구에 대한 알림이 있습니다.`;
    }
  }

  const sql = `
        INSERT INTO notifications (user_id, title, message, type)
        VALUES (?, ?, ?, ?)
    `;

  // 원래의 message 대신 포맷팅된 finalMessage를 DB에 저장합니다.
  db.query(sql, [user_id, title, finalMessage, type || 'info'], (err, result) => {
    if (err) {
      console.error('알림 생성 에러:', err);
      return res.status(500).json({ message: '알림 생성 실패' });
    }

    res.json({ message: '알림 생성 완료', notificationId: result.insertId });
  });
});

module.exports = router;