const mysql = require('mysql2');

const db = mysql.createPool({
    host: 'turntable.proxy.rlwy.net',
    user: 'root',
    password: 'wsxOYdQguktaHckZoyESufWdxDoIKnFH',
    database: 'railway',
    port: 42253,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

console.log('Railway MySQL Pool 생성 완료!');

module.exports = db;