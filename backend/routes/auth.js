const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');

// 🚨 주의: routes 폴더 안에 있기 때문에 db.js를 찾으려면 
// '../' 를 써서 상위 폴더로 한 번 나가야 해!
const pool = require('../db'); 

// 🚀 회원가입 API
// server.js에서 '/api' 경로를 기본으로 연결해 줄 거라서, 
// 여기서는 '/signup'만 적어도 최종적으로 '/api/signup'이 돼!
router.post('/signup', async (req, res) => {
    try {
        const { emailId, emailDomain, nickname, password } = req.body;
        const fullEmail = `${emailId}@${emailDomain}`;

        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await pool.promise().query(
            'INSERT INTO users (email, nickname, password) VALUES (?, ?, ?)',
            [fullEmail, nickname, hashedPassword]
        );

        res.status(201).json({ message: '회원가입이 완료되었습니다!' });

    } catch (error) {
        console.error('회원가입 에러:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: '이미 가입된 이메일입니다.' });
        }
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// 만든 라우터를 밖에서 쓸 수 있게 내보내기
module.exports = router;