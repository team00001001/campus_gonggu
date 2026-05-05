from fastapi import FastAPI

app = FastAPI()

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
        }
    ]