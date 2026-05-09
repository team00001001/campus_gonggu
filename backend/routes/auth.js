const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../db');

// 회원가입 API
router.post('/signup', async (req, res) => {
    try {
        const { emailId, emailDomain, nickname, password } = req.body;

        const fullEmail = `${emailId}@${emailDomain}`;

        const hashedPassword = await bcrypt.hash(password, 10);

        await pool.promise().query(
            'INSERT INTO users (email, nickname, password) VALUES (?, ?, ?)',
            [fullEmail, nickname, hashedPassword]
        );

        res.status(201).json({
            message: '회원가입 완료!'
        });

    } catch (error) {
        console.error('회원가입 에러:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                message: '이미 가입된 이메일입니다.'
            });
        }

        res.status(500).json({
            message: '서버 오류가 발생했습니다.'
        });
    }
});

// 로그인 API
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const [rows] = await pool.promise().query(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        if (rows.length === 0) {
            return res.status(401).json({
                message: '가입되지 않은 이메일입니다.'
            });
        }

        const user = rows[0];

        const isPasswordMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!isPasswordMatch) {
            return res.status(401).json({
                message: '비밀번호가 일치하지 않습니다.'
            });
        }

        res.status(200).json({
            message: '로그인 성공!',
            userId: user.id,
            nickname: user.nickname,
            email: user.email
        });

    } catch (error) {
        console.error('로그인 에러:', error);

        res.status(500).json({
            message: '서버 오류가 발생했습니다.'
        });
    }
});

module.exports = router;