// 1. 데이터 파일 경로 및 기초 설정
const API_URL = 'http://localhost:3000/products';
const roomGrid = document.getElementById('roomGrid');
const searchInput = document.getElementById('main-search');
const resultText = document.getElementById('resultText');

let allProducts = []; 

// [추가] URL에서 카테고리 정보 미리 읽어오기
const urlParams = new URLSearchParams(window.location.search);
const currentCategory = urlParams.get('category');
const searchKeyword = urlParams.get('search') || '';
// 2. 데이터 불러오기
function fetchProducts() {
    fetch(API_URL)
        .then(response => {
            if(!response.ok) throw new Error("네트워크 오류");
            return response.json();
        })
        .then(data => {
            allProducts = data;

            if (searchInput && searchKeyword) {
                searchInput.value = searchKeyword;
            }

            const initialKeyword = searchKeyword || "";

            filterAndRender(initialKeyword);

            if (currentCategory && searchInput) {
                searchInput.placeholder = `"${currentCategory}" 내에서 검색...`;
            }
        })
        .catch(error => console.error('데이터를 불러오지 못했습니다:', error));
}

// 3. 화면에 카드를 그리는 함수 (기존과 동일)
function renderRooms(rooms, keyword) {
    if (!roomGrid) return;
    roomGrid.innerHTML = ''; 

    // 결과 텍스트 업데이트 로직
    if (resultText) {
        if (currentCategory && !keyword) {
            resultText.style.display = 'block';
            resultText.innerHTML = `<span>'${currentCategory}'</span> 카테고리 결과입니다.`;
        } else if (keyword) {
            resultText.style.display = 'block';
            const categoryInfo = currentCategory ? `[${currentCategory}] 내 ` : "";
            resultText.innerHTML = `<span>${categoryInfo}'${keyword}'</span> 검색 결과입니다.`;
        } else {
            resultText.style.display = 'none';
        }
    }

    if(rooms.length === 0) {
        roomGrid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: #888; padding: 60px 0; font-size: 18px;">검색 결과가 없습니다.</p>';
        return;
    }

    rooms.forEach(room => {
        const formattedPrice = room.price.toLocaleString();
        const isClosed = room.currentCount >= room.targetCount;
        const statusText = isClosed ? "모집마감" : "모집중";
        const badgeStyle = isClosed ? "background-color: #E9ECEF; color: #868E96;" : "";

        const cardHTML = `
            <div class="product-card" onclick="location.href='product.html?id=${room.id}'">
                <div class="img-area" style="padding: 0;">
                    <img src="${room.imageUrl}" alt="${room.title}" 
                         onerror="this.outerHTML='<div style=\\'font-size: 60px;\\'>📦</div>'" 
                         style="width: 100%; height: 100%; object-fit: cover;">
                </div>
                <div class="card-body">
                    <div class="category-tag">
                        ${room.category} <span style="color:#ddd; margin:0 6px;">|</span> 📍 ${room.location}
                    </div>
                    <div class="product-title">${room.title}</div>
                    <p style="font-size: 13px; color: #777; margin-bottom: 8px;">
                        작성자: ${room.writer || '익명 학우'}
                    </p>
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

// 4. [핵심 수정] 검색과 카테고리를 동시에 필터링하는 함수
function filterAndRender(keyword) {
    const lowerKeyword = keyword.trim().toLowerCase();

    const filteredProducts = allProducts.filter(product => {
        // 조건 1: 카테고리 필터링 (URL 파라미터가 있을 때만 작동)
        const matchesCategory = currentCategory ? (product.category === currentCategory) : true;
        
        // 조건 2: 검색어 필터링
        const matchesSearch = !lowerKeyword || (
            product.title.toLowerCase().includes(lowerKeyword) ||
            product.category.toLowerCase().includes(lowerKeyword) ||
            (product.description && product.description.toLowerCase().includes(lowerKeyword))
        );

        return matchesCategory && matchesSearch; // 두 조건 모두 만족해야 함
    });

    renderRooms(filteredProducts, keyword);
}

// 5. 사용자가 검색창에 글자를 칠 때마다 실행
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const keyword = e.target.value.trim();
        filterAndRender(keyword);
    });
}

// 6. 실행 시작
fetchProducts();