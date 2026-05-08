const pool = require('./db'); // 친구가 만든 DB 연결 파일

async function createTable() {
    try {
        const sql = `
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) NOT NULL UNIQUE,
                nickname VARCHAR(50) NOT NULL,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;
        // DB에 테이블 생성 명령 날리기
        await pool.promise().query(sql);
        console.log("🎉 users 테이블 생성 완벽하게 성공!");
        process.exit(0); // 작업 끝나면 종료
    } catch (error) {
        console.error("테이블 생성 실패 ㅠㅠ:", error);
        process.exit(1);
    }
}

createTable();