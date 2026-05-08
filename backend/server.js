const express = require('express');
const cors = require('cors');
const fs = require('fs');

const app = express();

app.use(cors());
app.use(express.json());

const PORT = 3000;

// 상품 목록 가져오기
app.get('/products', (req, res) => {
    fs.readFile('./products.json', 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ error: '파일 읽기 실패' });
        }

        const products = JSON.parse(data);
        res.json(products);
    });
});

// 상품 추가
app.post('/products', (req, res) => {
    const newProduct = req.body;

    fs.readFile('./products.json', 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ error: '파일 읽기 실패' });
        }

        const products = JSON.parse(data);

        newProduct.id = products.length + 1;

        products.push(newProduct);

        fs.writeFile(
            './products.json',
            JSON.stringify(products, null, 2),
            err => {
                if (err) {
                    return res.status(500).json({ error: '파일 저장 실패' });
                }

                res.json({
                    message: '상품 추가 완료',
                    product: newProduct
                });
            }
        );
    });
});

app.listen(PORT, () => {
    console.log(`서버 실행 중: http://localhost:${PORT}`);
});