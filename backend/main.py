from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# 프론트와 백엔드 연결 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {"message": "Backend running"}

@app.get("/api/posts")
def get_posts():
    return [
        {
            "id": 1,
            "title": "과자 공동구매",
            "description": "여러 종류 같이 구매해요",
            "people": "3/5명",
            "deadline": "오늘 마감"
        },
        {
            "id": 2,
            "title": "생수 묶음",
            "description": "2L 대용량 같이 구매",
            "people": "2/4명",
            "deadline": "내일 마감"
        },
        {
            "id": 3,
            "title": "배달 공동주문",
            "description": "최소금액 맞추기",
            "people": "1/3명",
            "deadline": "오늘 밤"
        }
    ]

@app.post("/api/login")
def login():
    return {
        "success": True,
        "message": "로그인 성공",
        "user": {
            "name": "홍길동",
            "schoolVerified": True,
            "trustScore": 92
        }
    }