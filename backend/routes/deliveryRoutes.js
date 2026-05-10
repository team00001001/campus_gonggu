// routes/deliveryRoutes.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
// server.js에서 이미 dotenv를 불렀지만, 라우터에서 쓸 때는 혹시 모르니 한 번 더 호출해줘도 좋습니다.
require('dotenv').config(); 

router.get('/tracking', async (req, res) => {
    // 프론트엔드에서 보낸 택배사 코드와 송장번호 받기
    const { carrierId, trackId } = req.query;

    if (!carrierId || !trackId) {
        return res.status(400).json({ message: '택배사 코드와 송장 번호가 필요합니다.' });
    }

    try {
        const apiUrl = 'http://info.sweettracker.co.kr/api/v1/trackingInfo';
        
        // axios로 스마트택배 API 호출
        const response = await axios.get(apiUrl, {
            params: {
                t_key: process.env.SWEET_TRACKER_API_KEY, // .env 파일에 저장된 API 키
                t_code: carrierId,
                t_invoice: trackId
            }
        });

        // 스마트택배에서 받은 결과를 그대로 프론트엔드로 전달
        res.json(response.data);

    } catch (error) {
        console.error('배송 API 연동 에러:', error);
        res.status(500).json({ message: '택배사 서버와 통신하는 데 실패했습니다.' });
    }
});

module.exports = router;