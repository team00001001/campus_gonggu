const createNotification = require('../utils/createNotification');
const express = require('express');
const router = express.Router();
const pool = require('../db');

// 크림슨 지수 계산 공통 함수 (최소 -100, 최대 100 제한)
async function updateTrustScore(userId, delta, conn) {
    await conn.query(`
        UPDATE users
        SET trust_score = LEAST(100, GREATEST(-100, trust_score + ?))
        WHERE id = ?
    `, [delta, userId]);
}

router.post('/join', async (req, res) => {
    const { productId, userId } = req.body;

    if (!productId || !userId) {
        return res.status(400).json({ message: 'productId 또는 userId가 없습니다.' });
    }

    const conn = await pool.promise().getConnection();

    try {
        await conn.beginTransaction();

        const [products] = await conn.query(
            // duration을 추가로 SELECT 합니다.
            'SELECT currentCount, targetCount, duration FROM products WHERE id = ? FOR UPDATE',
            [productId]
        );

        if (products.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: '공구방을 찾을 수 없습니다.' });
        }

        const product = products[0];
        const now = Math.floor(Date.now() / 1000);

        // 기존 인원수 검증에 시간 만료 검증 로직을 추가합니다.
        if (product.currentCount >= product.targetCount || Number(product.duration) <= now) {
            await conn.rollback();
            return res.status(400).json({ message: '이미 모집이 마감된 공구입니다.' });
        }
        
        const [existing] = await conn.query(
            `
            SELECT status
            FROM product_participants
            WHERE product_id = ? AND user_id = ?
            FOR UPDATE
            `,
            [productId, userId]
        );

        if (existing.length > 0) {
            const status = existing[0].status;

            if (status === 'joined') {
                await conn.rollback();
                return res.status(409).json({ message: '이미 참여한 공구입니다.' });
            }

            if (status === 'cancelled') {
                await conn.query(
                    `
                    UPDATE product_participants
                    SET status = 'joined',
                        created_at = CURRENT_TIMESTAMP
                    WHERE product_id = ? AND user_id = ?
                    `,
                    [productId, userId]
                );
                await conn.query(
                    'UPDATE products SET currentCount = currentCount + 1 WHERE id = ?',
                    [productId]
                );

                // 공구 정보 조회
                const [[productInfo]] = await conn.query(
                    `
    SELECT title, user_id
    FROM products
    WHERE id = ?
    `,
                    [productId]
                );

                await conn.commit();

                // 자기 공구 제외
                if (
                    productInfo &&
                    String(productInfo.user_id) !== String(userId)
                ) {
                    const [[rejoinUser]] = await conn.query(
                        `
    SELECT nickname
    FROM users
    WHERE id = ?
    `,
                        [userId]
                    );
                    createNotification(
                        productInfo.user_id,
                        '참여자가 다시 들어왔습니다',
                        `"${productInfo.title}" 공구에 <b>${rejoinUser.nickname}</b>님이 다시 참여했습니다.`, 'success', productId
                    );
                }

                const newCountReJoin = product.currentCount + 1;
                // 💡 [수정됨] 재참여 시 목표 인원 달성 처리 (수정하신 부분 - 잘 적용됨)
                if (newCountReJoin >= product.targetCount) {
                    const [allParticipants] = await pool.promise().query(
                        `SELECT user_id FROM product_participants WHERE product_id = ? AND status NOT IN ('cancelled', 'noshow')`,
                        [productId]
                    );
                    // 방장에게 거래 완료 확인 필요 알림 전송
                    createNotification(productInfo.user_id, '거래 완료 확인 필요', `"${productInfo.title}" 공구의 거래 완료 확인이 필요합니다. 택배 수령과 참여자 물건 수령 후 확인 버튼을 눌러주세요.`, 'success', productId);
                    allParticipants.forEach(p => {
                        if (String(p.user_id) !== String(productInfo.user_id)) {
                            // 참여자에게 마감 알림 전송
                            createNotification(p.user_id, '목표 인원 달성', `참여 중인 "${productInfo.title}" 공구가 목표 인원을 달성했습니다.`, 'success', productId);
                        }
                    });
                }

                return res.status(200).json({ message: '공구 재참여 완료' });
            }
        }


        const [insertResult] = await conn.query(
            `
    INSERT INTO product_participants (product_id, user_id, status)
    VALUES (?, ?, 'joined')
    `,
            [productId, userId]
        );


        const [updateResult] = await conn.query(
            'UPDATE products SET currentCount = currentCount + 1 WHERE id = ?',
            [productId]
        );

        console.log('currentCount UPDATE 결과:', updateResult);
        // 공구 정보 조회
        const [[productInfo]] = await conn.query(
            `
    SELECT title, user_id
    FROM products
    WHERE id = ?
    `,
            [productId]
        );

        await conn.commit();

        // 자기 공구 참여는 제외
        if (
            productInfo &&
            String(productInfo.user_id) !== String(userId)
        ) {
            console.log('알림 생성 시도:', productInfo.user_id, productInfo.title);
            const [[joinedUser]] = await conn.query(
                `
    SELECT nickname
    FROM users
    WHERE id = ?
    `,
                [userId]
            );
            createNotification(
                productInfo.user_id,
                '새 참여자가 생겼습니다',
                `"${productInfo.title}" 공구에 <b>${joinedUser.nickname}</b>님이 참여했습니다.`,
                'success', productId
            );
        }

        const newCountJoin = product.currentCount + 1;
        // 💡 [여기가 놓친 부분입니다!] 최초 참여 시 목표 인원 달성 처리
        if (newCountJoin >= product.targetCount) {
            const [allParticipants] = await pool.promise().query(
                `SELECT user_id FROM product_participants WHERE product_id = ? AND status NOT IN ('cancelled', 'noshow')`,
                [productId]
            );
            // 👇 방장에게 거래 완료 확인 필요 알림 전송 (이 부분도 원하시는 문구로 통일해서 수정했습니다!)
            createNotification(productInfo.user_id, '거래 완료 확인 필요', `"${productInfo.title}" 공구의 거래 완료 확인이 필요합니다. 택배 수령과 참여자 물건 수령 후 확인 버튼을 눌러주세요.`, 'success', productId);
            allParticipants.forEach(p => {
                if (String(p.user_id) !== String(productInfo.user_id)) {
                     // 참여자에게 마감 알림 전송
                    createNotification(p.user_id, '목표 인원 달성', `참여 중인 "${productInfo.title}" 공구가 목표 인원을 달성했습니다.`, 'success', productId);
                }
            });
        }

        res.status(201).json({ message: '공구 참여 완료' });

    } catch (error) {
        await conn.rollback();
        console.error(error);
        res.status(500).json({ message: '공구 참여 실패' });
    } finally {
        conn.release();
    }
});

router.patch('/cancel', async (req, res) => {
    const { productId, userId } = req.body;

    if (!productId || !userId) {
        return res.status(400).json({ message: 'productId 또는 userId가 없습니다.' });
    }

    const conn = await pool.promise().getConnection();

    try {
        await conn.beginTransaction();

        // [추가된 로직 시작] 마감된 공구인지 먼저 확인합니다.
        const [[productInfoRow]] = await conn.query(
            `SELECT duration, currentCount, targetCount FROM products WHERE id = ?`,
            [productId]
        );

        if (productInfoRow) {
            const now = Math.floor(Date.now() / 1000);
            const isExpired = Number(productInfoRow.duration) <= now;
            const isFull = productInfoRow.currentCount >= productInfoRow.targetCount;
            
            // 인원이 다 찼거나, 시간이 지났으면 취소 불가 에러 반환
            if (isExpired || isFull) {
                await conn.rollback();
                return res.status(400).json({ message: '이미 마감된 공구는 참여를 취소할 수 없습니다.' });
            }
        }

        const [rows] = await conn.query(
            `
            SELECT *
            FROM product_participants
            WHERE product_id = ?
            AND user_id = ?
            AND status NOT IN ('cancelled', 'noshow')
            `,
            [productId, userId]
        );

        if (rows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: '참여 내역이 없습니다.' });
        }

        await conn.query(
            `
            UPDATE product_participants
            SET status = 'cancelled'
            WHERE product_id = ?
            AND user_id = ?
            AND status NOT IN ('cancelled', 'noshow')
            `,
            [productId, userId]
        );

        await conn.query(
            `
            UPDATE products
            SET currentCount = GREATEST(currentCount - 1, 0)
            WHERE id = ?
            `,
            [productId]
        );

        const [[productInfo]] = await conn.query(
            `
    SELECT title, user_id
    FROM products
    WHERE id = ?
    `,
            [productId]
        );

        await conn.commit();

        if (
            productInfo &&
            String(productInfo.user_id) !== String(userId)
        ) {
            const [[cancelUser]] = await conn.query(
                `
    SELECT nickname
    FROM users
    WHERE id = ?
    `,
                [userId]
            );
            createNotification(
                productInfo.user_id,
                '참여자가 나갔습니다',
                `"${productInfo.title}" 공구에서 <b>${cancelUser.nickname}</b>님이 나갔습니다.`,
                'notice', productId
            );
        }

        res.json({ message: '참여 취소 완료' });

    } catch (error) {
        await conn.rollback();
        console.error(error);
        res.status(500).json({ message: '참여 취소 실패' });
    } finally {
        conn.release();
    }
});

router.get('/', async (req, res) => {
    const { productId } = req.query;

    if (!productId) {
        return res.status(400).json({
            message: 'productId가 필요합니다.'
        });
    }
//여기 주의
    try {
        const [rows] = await pool.promise().query(
            `
            SELECT
                pp.id AS participant_id,
                pp.product_id,
                pp.user_id,
                pp.status,
                pp.created_at,
                pp.is_received,  
                u.nickname,
                u.email,
                u.trust_score
            FROM product_participants pp
            JOIN users u ON pp.user_id = u.id
            WHERE pp.product_id = ?
            AND pp.status != 'cancelled'
            ORDER BY pp.created_at ASC
            `,
            [productId]
        );

        res.json(rows);

    } catch (error) {
        console.error('참여자 조회 실패:', error);
        res.status(500).json({
            message: '참여자 조회 실패'
        });
    }
});

// // ==========================================
// // 1. 방장이 참여자의 상태(노쇼/확인)를 업데이트하는 API
// // ==========================================
// router.patch('/status', async (req, res) => {
//     const { participantId, userId, status, productId } = req.body;

//     const conn = await pool.promise().getConnection();
//     try {
//         await conn.beginTransaction();

//         // 🚨 알림에 사용할 공구 제목(title) 미리 가져오기
//         let targetProductId = productId;
//         if (!targetProductId) {
//             const [rows] = await conn.query(
//                 `SELECT product_id FROM product_participants WHERE id = ?`,
//                 [participantId]
//             );
//             if (rows.length > 0) {
//                 targetProductId = rows[0].product_id;
//             }
//         }

//         let productTitle = "공구";
//         if (targetProductId) {
//             const [[pRow]] = await conn.query(
//                 `SELECT title FROM products WHERE id = ?`, 
//                 [targetProductId]
//             );
//             if (pRow) productTitle = pRow.title;
//         }

//         if (status === 'noshow') {
//             // 1. 상태를 노쇼로 변경
//             await conn.query(
//                 `UPDATE product_participants SET status = 'noshow' WHERE id = ?`,
//                 [participantId]
//             );

//             // 2. 신뢰도 10점 차감
//             await updateTrustScore(userId, -10, conn);

//             // 3. 인원수 -1 감소 처리
//             if (targetProductId) {
//                 await conn.query(
//                     `UPDATE products 
//                     SET currentCount = currentCount - 1 
//                     WHERE id = ? AND currentCount > 0`,
//                     [targetProductId]
//                 );
//             }

//             createNotification(
//                 userId,
//                 '노쇼 처리 안내',
//                 '노쇼 처리가 반영되었습니다.',
//                 'notice', targetProductId
//             );

//         } else {
//             // 확인(confirmed) 버튼 눌렀을 때
//             await conn.query(
//                 `UPDATE product_participants SET status = ? WHERE id = ?`,
//                 [status, participantId]
//             );
//             // 성공 시 +3점 부여
//             await updateTrustScore(userId, 3, conn);

//             // 🔔 [알림 전송] 참여자에게 확인 완료 알림
//             createNotification(
//                 userId,
//                 '참여 확인 완료',
//                 `"${productTitle}" 공구 방장이 참여를 확인했습니다. 물건 수령 후 '수령 확인' 버튼을 눌러주세요.`,
//                 'success', targetProductId
//             );
//         }

//         await conn.commit();
//         res.json({ message: '상태 업데이트 및 인원수 반영 완료' });

//     } catch (error) {
//         await conn.rollback();
//         console.error("상태 업데이트 에러:", error);
//         res.status(500).json({ message: '상태 업데이트 실패' });
//     } finally {
//         conn.release();
//     }
// });
// ==========================================
// 1. 방장이 참여자의 상태(노쇼/확인)를 업데이트하는 API
// ==========================================
router.patch('/status', async (req, res) => {
    const { participantId, userId, status } = req.body; // productId는 DB에서 직접 가져오는 게 더 정확합니다.

    const conn = await pool.promise().getConnection();
    try {
        await conn.beginTransaction();

        // 🚨 [핵심 수정] 참여자 ID(participantId)를 통해 해당 공구의 ID와 제목(title)을 한 번에 가져옵니다.
        // 이렇게 하면 어떤 상황에서도 productTitle이 누락되지 않습니다.
        const [infoRows] = await conn.query(`
            SELECT p.id AS targetProductId, p.title AS productTitle 
            FROM products p
            JOIN product_participants pp ON p.id = pp.product_id
            WHERE pp.id = ?
        `, [participantId]);

        if (infoRows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: '참여 정보를 찾을 수 없습니다.' });
        }

        const { targetProductId, productTitle } = infoRows[0];

        if (status === 'noshow') {
            // 1. 상태를 노쇼로 변경
            await conn.query(
                `UPDATE product_participants SET status = 'noshow' WHERE id = ?`,
                [participantId]
            );

            // 2. 신뢰도 10점 차감
            await updateTrustScore(userId, -10, conn);

            // 3. 인원수 -1 감소 처리 (GREATEST로 0 이하 방지)
            await conn.query(
                `UPDATE products 
                 SET currentCount = GREATEST(currentCount - 1, 0) 
                 WHERE id = ?`,
                [targetProductId]
            );

            // 🔔 [노쇼 알림 발송] 이제 "${productTitle}"에 실제 방 이름이 담깁니다.
            await createNotification(
                userId,
                '노쇼 처리 안내',
                `"${productTitle}" 공구에서 노쇼 처리가 반영되었습니다.`,
                'notice', 
                targetProductId
            );

        } else {
            // 확인(confirmed) 버튼 눌렀을 때
            await conn.query(
                `UPDATE product_participants SET status = ? WHERE id = ?`,
                [status, participantId]
            );
            // 성공 시 +3점 부여
            await updateTrustScore(userId, 3, conn);

            // 🔔 [확인 알림 발송]
            await createNotification(
                userId,
                '참여 확인 완료',
                `"${productTitle}" 공구 방장이 참여를 확인했습니다. 물건 수령 후 '수령 확인' 버튼을 눌러주세요.`,
                'success', 
                targetProductId
            );
        }

        await conn.commit();
        res.json({ message: '상태 업데이트 완료' });

    } catch (error) {
        await conn.rollback();
        console.error("상태 업데이트 에러:", error);
        res.status(500).json({ message: '상태 업데이트 실패' });
    } finally {
        conn.release();
    }
});

// ==========================================
// 2. 참여자 -> 수령 완료 확인 및 자동 최종 완료 처리 API
// ==========================================
// [API] 참여자 -> 수령 완료 확인 및 자동 최종 완료 처리
router.patch('/receive', async (req, res) => {
    const { productId, userId } = req.body;
    const conn = await pool.promise().getConnection();

    try {
        await conn.beginTransaction();

        // 🚨 [추가 1] 백엔드에서도 방장 확인 여부(상태)를 한 번 더 검증
        const [[member]] = await conn.query(`
            SELECT status FROM product_participants WHERE product_id = ? AND user_id = ?
        `, [productId, userId]);

        if (!member) {
            await conn.rollback();
            return res.status(404).json({ message: '참여 정보를 찾을 수 없습니다.' });
        }
        if (member.status === 'joined') {
            await conn.rollback();
            return res.status(403).json({ message: '방장의 참여 확인 후 수령할 수 있습니다.' });
        }
        if (member.status === 'noshow' || member.status === 'cancelled') {
            await conn.rollback();
            return res.status(400).json({ message: '수령 가능한 상태가 아닙니다.' });
        }

        // 1. 참여자 본인 수령 완료 처리
        await conn.query(`
            UPDATE product_participants
            SET is_received = 1, status = 'completed'
            WHERE product_id = ? AND user_id = ?
        `, [productId, userId]);

        // 2. 전체 유효 참여자 수 (확인되었거나 수령완료한 사람들만)
        const [[totalRow]] = await conn.query(`
            SELECT COUNT(*) AS cnt FROM product_participants
            WHERE product_id = ? AND status IN ('confirmed', 'completed')
        `, [productId]);
        const total = totalRow.cnt;

        // 3. 수령 완료 누른 사람 수
        const [[receivedRow]] = await conn.query(`
            SELECT COUNT(*) AS cnt FROM product_participants
            WHERE product_id = ? AND is_received = 1
        `, [productId]);
        const received = receivedRow.cnt;

        // 🚨 [추가 2] 아직 방장이 처리하지 않은(joined) 대기 인원이 있는지 확인
        const [[pendingRow]] = await conn.query(`
            SELECT COUNT(*) AS cnt FROM product_participants
            WHERE product_id = ? AND status = 'joined'
        `, [productId]);
        const pendingCount = pendingRow.cnt;

        let isFinalSuccess = false;

        // 4. 모든 유효 참여자가 수령했고 & 미처리 대기 인원도 없을 때만 성공 처리
        if (total > 0 && received >= total && pendingCount === 0) {
            
            // 신고 건수 확인
            const [[reportRow]] = await conn.query(`
                SELECT COUNT(*) AS cnt FROM reports WHERE product_id = ?
            `, [productId]);
            const reportCount = reportRow.cnt;

            let isBlocked = false;
            if (total < 3 && reportCount >= 1) isBlocked = true;
            if (total >= 3 && reportCount >= 2) isBlocked = true;

            if (!isBlocked) {
                const [[product]] = await conn.query(`
                    SELECT user_id, trust_rewarded FROM products WHERE id = ? FOR UPDATE
                `, [productId]);

                if (product && product.trust_rewarded === 0) {
                    // 방장 점수 부여 (+10)
                    await updateTrustScore(product.user_id, 10, conn);

                    // 유효 참여자들 점수 부여 (+2)
                    await conn.query(`
                        UPDATE users
                        SET trust_score = LEAST(100, trust_score + 2)
                        WHERE id IN (
                            SELECT user_id FROM product_participants
                            WHERE product_id = ? AND status IN ('confirmed', 'completed')
                        )
                    `, [productId]);

                    // ✅ 최종 마킹: status를 success로, 보상 완료 표시
                    await conn.query(`
                        UPDATE products
                        SET status = 'success', trust_rewarded = 1
                        WHERE id = ?
                    `, [productId]);
                    
                    isFinalSuccess = true;
                }
            }
        }

        await conn.commit();
        res.json({ success: true, received, total, isFinalSuccess });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).json({ message: '수령 확인 처리 실패' });
    } finally {
        conn.release();
    }
});
// 유저의 현재 크림슨 지수를 가져오는 API (신규 추가)
router.get('/trust-score/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const [rows] = await pool.promise().query(
            'SELECT trust_score FROM users WHERE id = ?',
            [userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
        }

        res.json({ trust_score: rows[0].trust_score });
    } catch (error) {
        console.error("신뢰도 조회 에러:", error);
        res.status(500).json({ message: '서버 에러' });
    }
});

module.exports = router;