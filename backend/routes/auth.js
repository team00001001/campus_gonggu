const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../db');
const axios = require('axios');

const authCodes = {};

// 🚀 1. 인증번호 전송 API
router.post('/send-auth-email', async (req, res) => {
    const { email } = req.body;
    
    try {
        // 💡 1. DB에 이메일이 이미 존재하는지 문지기가 먼저 검사!
        const [rows] = await pool.promise().query(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        // 이미 가입된 데이터가 있다면 여기서 컷! (409 에러 프론트로 전송)
        if (rows.length > 0) {
            return res.status(409).json({ message: '이미 등록된 이메일입니다.' });
        }

        const authCode = Math.floor(100000 + Math.random() * 900000).toString();

        await axios.post('https://api.brevo.com/v3/smtp/email', {
            sender: { name: 'Campus Gonggu', email: 'gongguyong0@gmail.com' },
            to: [{ email }],
            subject: '[대학생 공동구매] 회원가입 인증번호입니다.',
            textContent: `안녕하세요! 회원가입 인증번호는 [${authCode}] 입니다. 3분 안에 입력해주세요!`
        }, {
            headers: { 'api-key': process.env.BREVO_API_KEY }
        });
        
        // 메모리에 '이메일: 인증번호' 형태로 3분간 저장
        authCodes[email] = authCode;
        setTimeout(() => {
            delete authCodes[email]; // 3분 뒤에 인증번호 삭제 (만료)
        }, 3 * 60 * 1000);

        res.status(200).json({ message: '인증번호가 전송되었습니다. 이메일을 확인해주세요!' });

    } catch (error) {
    console.error('인증번호 처리 에러 전체:', error);
    console.error('에러 코드:', error.code);
    console.error('에러 응답:', error.response);

    res.status(500).json({
        message: '메일 전송에 실패했습니다.',
        error: error.message
    });
}
});
// 🚀 2. 인증번호 확인 API
router.post('/verify-auth-code', (req, res) => {
    const { email, code } = req.body;
console.log('인증 메일 요청 들어옴:', email);
    // 저장된 인증번호와 입력한 번호가 같은지 확인
    if (authCodes[email] && authCodes[email] === code) {
        // 성공하면 삭제해서 재사용 방지
        delete authCodes[email];
        res.status(200).json({ message: '이메일 인증이 완료되었습니다!' });
    } else {
        res.status(400).json({ message: '인증번호가 틀렸거나 만료되었습니다.' });
    }
});

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

// 🚀 비밀번호 찾기 (임시 비밀번호 발급 및 메일 전송) API
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    try {
        // 1. DB에 가입된 이메일인지 먼저 확인
        const [rows] = await pool.promise().query(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: '가입되지 않은 이메일입니다.' });
        }

        // 2. 임시 비밀번호 생성 (8자리 영문+숫자 랜덤 문자열)
        const tempPassword = Math.random().toString(36).slice(-8);

        // 3. 임시 비밀번호 해싱 (암호화)
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        // 4. DB에 사용자의 비밀번호를 임시 비밀번호로 업데이트
        await pool.promise().query(
            'UPDATE users SET password = ? WHERE email = ?',
            [hashedPassword, email]
        );

        // 5. 회원가입 때 썼던 Brevo 메일 발송 로직 그대로 사용!
        await axios.post('https://api.brevo.com/v3/smtp/email', {
            sender: { name: 'Campus Gonggu', email: 'gongguyong0@gmail.com' },
            to: [{ email }],
            subject: '[대학생 공동구매] 임시 비밀번호가 발급되었습니다.',
            textContent: `안녕하세요! 요청하신 임시 비밀번호는 [ ${tempPassword} ] 입니다. 로그인 후 마이페이지에서 반드시 비밀번호를 변경해주세요!`
        }, {
            headers: { 'api-key': process.env.BREVO_API_KEY }
        });

        res.status(200).json({ message: '임시 비밀번호가 메일로 발송되었습니다.' });

    } catch (error) {
        console.error('비밀번호 찾기 에러:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

module.exports = router;