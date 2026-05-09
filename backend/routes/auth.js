const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../db');
const nodemailer = require('nodemailer');

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

        // 💡 2. 여기까지 무사히 통과했다면? 원래대로 메일 전송 시작!
        // 환경 변수 체크: 메일 전송에 필요한 환경 변수가 설정되어 있는지 확인
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            throw new Error('EMAIL_USER와 EMAIL_PASS 환경 변수가 설정되지 않았습니다. .env 파일을 확인해주세요.');
        }

        const authCode = Math.floor(100000 + Math.random() * 900000).toString();

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: '[대학생 공동구매] 회원가입 인증번호입니다.',
            text: `안녕하세요! 회원가입 인증번호는 [${authCode}] 입니다. 3분 안에 입력해주세요!`
        };

        // 이메일 슝~ 전송
        await transporter.sendMail(mailOptions);
        
        // 메모리에 '이메일: 인증번호' 형태로 3분간 저장
        authCodes[email] = authCode;
        setTimeout(() => {
            delete authCodes[email]; // 3분 뒤에 인증번호 삭제 (만료)
        }, 3 * 60 * 1000);

        res.status(200).json({ message: '인증번호가 전송되었습니다. 이메일을 확인해주세요!' });

    } catch (error) {
        // 💡 3. 위에서 발생한 DB 에러나 이메일 전송 에러를 여기서 한 번에 다 잡음! (Missing catch 해결)
        console.error('인증번호 처리 에러:', error);
        res.status(500).json({ message: '메일 전송에 실패했습니다.' });
    }
});
// 🚀 2. 인증번호 확인 API
router.post('/verify-auth-code', (req, res) => {
    const { email, code } = req.body;

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

module.exports = router;