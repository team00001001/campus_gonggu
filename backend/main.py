from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

posts = [
    {
        "id": 1,
        "title": "과자 공동구매",
        "description": "여러 종류 같이 구매해요",
        "people": "3/5명",
        "deadline": "오늘 마감",
        "price": "10,000원",
        "place": "학생회관 앞"
    },
    {
        "id": 2,
        "title": "생수 묶음",
        "description": "2L 대용량 같이 구매",
        "people": "2/4명",
        "deadline": "내일 마감",
        "price": "8,000원",
        "place": "기숙사 로비"
    },
    {
        "id": 3,
        "title": "배달 공동주문",
        "description": "최소금액 맞추기",
        "people": "1/3명",
        "deadline": "오늘 밤",
        "price": "각자 정산",
        "place": "정문 앞"
    }
]

@app.get("/")
def home():
    return {"message": "Backend running"}

@app.get("/api/posts")
def get_posts():
    return posts

@app.get("/api/posts/{post_id}")
def get_post_detail(post_id: int):
    for post in posts:
        if post["id"] == post_id:
            return post

    raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")