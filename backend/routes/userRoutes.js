const bcrypt = require('bcrypt');
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
router.put('/:id/password', (req, res) => {
    const userId = req.params.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: '비밀번호를 모두 입력해주세요.' });
    }

    const selectSql = 'SELECT password FROM users WHERE id = ?';

    db.query(selectSql, [userId], async (err, results) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ message: '서버 오류' });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
        }

        const user = results[0];

        const isMatch = await bcrypt.compare(currentPassword, user.password);

        if (!isMatch) {
            return res.status(401).json({ message: '현재 비밀번호가 일치하지 않습니다.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        const updateSql = 'UPDATE users SET password = ? WHERE id = ?';

        db.query(updateSql, [hashedPassword, userId], (err) => {
            if (err) {
                console.log(err);
                return res.status(500).json({ message: '비밀번호 변경 실패' });
            }

            res.json({ message: '비밀번호 변경 성공' });
        });
    });
});
router.delete('/:id', (req, res) => {
    const userId = req.params.id;

    // 1. 유저가 올린 공고 먼저 삭제
    const deleteProductsSql = `
        DELETE FROM products
        WHERE user_id = ?
    `;

    db.query(deleteProductsSql, [userId], (err) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ message: '공고 삭제 실패' });
        }

        // 2. 유저 삭제
        const deleteUserSql = `
            DELETE FROM users
            WHERE id = ?
        `;

        db.query(deleteUserSql, [userId], (err) => {
            if (err) {
                console.log(err);
                return res.status(500).json({ message: '회원 탈퇴 실패' });
            }

            res.json({ message: '회원 탈퇴 성공' });
        });
    });
});
// GET /users/:userId/profile - 방장 프로필 조회
router.get('/:userId/profile', async (req, res) => {
    const { userId } = req.params;
    try {
        const [[user]] = await db.promise().query(
            `SELECT id, nickname, trust_score FROM users WHERE id = ?`,
            [userId]
        );
        if (!user) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });

        const [[hostDeals]] = await db.promise().query(
            `SELECT COUNT(DISTINCT p.id) AS count
             FROM products p
             WHERE p.user_id = ?
               AND EXISTS (
                   SELECT 1 FROM product_participants pp
                   WHERE pp.product_id = p.id AND pp.status = 'completed'
               )`,
            [userId]
        );

        const [[reviewCount]] = await db.promise().query(
            `SELECT COUNT(*) AS count FROM reviews WHERE host_id = ?`,
            [userId]
        );

        res.json({
            id: user.id,
            nickname: user.nickname,
            trust_score: user.trust_score,
            completedDeals: hostDeals.count,
            reviewCount: reviewCount.count
        });
    } catch (e) {
        console.error('프로필 조회 실패:', e);
        res.status(500).json({ message: '서버 오류' });
    }
});

module.exports = router;