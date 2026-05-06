// 1. 데이터 파일 경로
const API_URL = 'products.json';

// 2. HTML 요소 가져오기
const roomGrid = document.getElementById('roomGrid');
const searchInput = document.getElementById('main-search');
const resultText = document.getElementById('resultText');

let allProducts = []; 

// 3. 데이터 불러오기
function fetchProducts() {
    fetch(API_URL)
        .then(response => {
            if(!response.ok) throw new Error("네트워크 오류");
            return response.json();
        })
        .then(data => {
            allProducts = data;
            // 처음 켜졌을 때 검색창에 있는 글자로 바로 검색 실행
            const initialKeyword = searchInput ? searchInput.value.trim() : "";
            filterAndRender(initialKeyword);
        })
        .catch(error => console.error('데이터를 불러오지 못했습니다:', error));
}

// 4. 화면에 예쁜 카드를 그리는 함수
function renderRooms(rooms, keyword) {
    if (!roomGrid) return;
    roomGrid.innerHTML = ''; 

    // 검색어 결과 텍스트 업데이트
    if (resultText) {
        if (keyword) {
            resultText.style.display = 'block';
            resultText.innerHTML = `<span>'${keyword}'</span> 검색 결과입니다.`;
        } else {
            resultText.style.display = 'none';
        }
    }

    // 결과가 없을 때
    if(rooms.length === 0) {
        roomGrid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: #888; padding: 60px 0; font-size: 18px;">검색 결과가 없습니다.</p>';
        return;
    }

    // 결과가 있을 때 카드 생성
    rooms.forEach(room => {
        // [자동화 1] 가격에 쉼표 찍기 (19000 -> 19,000)
        const formattedPrice = room.price.toLocaleString();
        
        // [자동화 2] 인원 수를 계산하여 '모집중' / '마감' 상태 정하기
        const isClosed = room.currentCount >= room.targetCount;
        const statusText = isClosed ? "모집마감" : "모집중";
        
        // 마감되었을 때 뱃지 색상을 회색으로 변경하는 스타일 적용
        const badgeStyle = isClosed ? "background-color: #E9ECEF; color: #868E96;" : "";

        const cardHTML = `
            <div class="product-card">
                <!-- 이미지 영역의 padding을 없애 이미지가 꽉 차게 만듭니다 -->
                <div class="img-area" style="padding: 0;">
                    <!-- [자동화 3] imageUrl을 실제 이미지로 넣고, 링크가 깨져있으면 기본 아이콘(📦)으로 대체합니다 -->
                    <img src="${room.imageUrl}" alt="${room.title}" 
                         onerror="this.outerHTML='<div style=\\'font-size: 60px;\\'>📦</div>'" 
                         style="width: 100%; height: 100%; object-fit: cover;">
                </div>
                <div class="card-body">
                    <!-- 카테고리 옆에 거래 장소(location)를 추가했습니다 -->
                    <div class="category-tag">
                        ${room.category} <span style="color:#ddd; margin:0 6px;">|</span> 📍 ${room.location}
                    </div>
                    
                    <div class="product-title">${room.title}</div>
                    
                    <!-- 기간(duration)과 현재 인원 현황을 추가했습니다 -->
                    <p style="font-size: 13px; color: #666; margin-bottom: 16px; margin-top: -6px; font-weight: 500;">
                        ⏳ ${room.duration} 남음 · 👥 ${room.currentCount}/${room.targetCount}명
                    </p>
                    
                    <div class="card-footer">
                        <div class="price">${formattedPrice}원</div>
                        <div class="badge" style="${badgeStyle}">${statusText}</div>
                    </div>
                </div>
            </div>
        `;
        roomGrid.insertAdjacentHTML('beforeend', cardHTML);
    });
}

// 5. 검색을 실행하는 함수
function filterAndRender(keyword) {
    const lowerKeyword = keyword.trim().toLowerCase();

    if (!lowerKeyword) {
        renderRooms(allProducts, keyword);
        return;
    }

    const filteredProducts = allProducts.filter(product => {
        const lowerTitle = product.title.toLowerCase();
        const lowerCategory = product.category.toLowerCase();
        const lowerDescription = product.description.toLowerCase();

        return (
            lowerTitle.includes(lowerKeyword) ||
            lowerCategory.includes(lowerKeyword) ||
            lowerDescription.includes(lowerKeyword)
        );
    });

    renderRooms(filteredProducts, keyword);
}

// 6. 사용자가 검색창에 글자를 칠 때마다 실행
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const keyword = e.target.value.trim();
        filterAndRender(keyword);
    });
}

// 7. 시작!
fetchProducts();