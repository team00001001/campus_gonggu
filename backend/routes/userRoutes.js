const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
    res.send('유저 라우터 연결 성공');
});

router.put('/:id/nickname', (req, res) => {
    const userId = req.params.id;
    const { nickname } = req.body;

    if (!nickname || !nickname.trim()) {
        return res.status(400).json({ message: '닉네임을 입력해주세요.' });
    }

    const sql = `
        UPDATE users
        SET nickname = ?
        WHERE id = ?
    `;

    db.query(sql, [nickname, userId], (err, result) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ message: '닉네임 변경 실패' });
        }

        res.json({ message: '닉네임 변경 성공' });
    });
});

module.exports = router;