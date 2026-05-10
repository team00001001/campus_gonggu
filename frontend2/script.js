const API_URL = 'http://localhost:3000/products';
const roomGrid = document.getElementById('roomGrid');
const loadMoreArea = document.getElementById('loadMoreArea');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const resultText = document.getElementById('resultText');

let allProducts = [];      // 전체 데이터 저장용
let filteredProducts = []; // 필터링된 데이터 저장용
let displayCount = 6;      // 초기에 보여줄 개수

// URL에서 파라미터 미리 읽기
const urlParams = new URLSearchParams(window.location.search);
const currentCategory = urlParams.get('category');
const initialSearch = urlParams.get('search') || '';

// 1. 데이터 가져오기 (가장 먼저 실행)
async function fetchProducts() {
    try {
        const response = await fetch(API_URL);
        allProducts = await response.json();
        
        console.log("가져온 데이터 개수:", allProducts.length);

        // 데이터 가져오기에 성공하면 바로 필터링 및 렌더링 실행
        applyFilter(initialSearch);
    } catch (error) {
        console.error("데이터 로딩 실패:", error);
        if(roomGrid) roomGrid.innerHTML = "<p>서버와 연결할 수 없습니다.</p>";
    }
}

// 2. 필터링 로직
function applyFilter(keyword) {
    const term = keyword.toLowerCase().trim();

    filteredProducts = allProducts.filter(p => {
        // [중요] 카테고리가 주소창에 있을 때만 카테고리 필터링 적용
        const matchCat = currentCategory ? (p.category === currentCategory) : true;
        
        // 검색어 필터링
        const matchSearch = p.title.toLowerCase().includes(term) || 
                            p.category.toLowerCase().includes(term);
        
        return matchCat && matchSearch;
    });

    displayCount = 6; // 필터링 될 때마다 6개로 초기화
    renderGrid();
}

// 3. 화면에 그리기
function renderGrid() {
    if (!roomGrid) return;
    roomGrid.innerHTML = '';

    if (filteredProducts.length === 0) {
        roomGrid.innerHTML = '<p style="text-align:center; padding: 50px;">해당하는 공구 물품이 없습니다.</p>';
        if(loadMoreArea) loadMoreArea.style.display = 'none';
        return;
    }

    // 6개씩 끊어서 보여주기
    const toShow = filteredProducts.slice(0, displayCount);
    
    toShow.forEach(product => {
    const percent = Math.min(Math.round((product.currentCount / product.targetCount) * 100), 100);
    const isClosed = product.isClosed || (product.currentCount >= product.targetCount);

    const defaultImages = {
        '식재료 / 배달': 'images/default-food.png',
        '자취 / 생필품': 'images/default-living.png',
        '전공 / 문구': 'images/default-study.png',
        '기타 물품': 'images/default-etc.png'
    };

    const fallbackImage = defaultImages[product.category] || 'images/default-etc.png';

    const hasValidImage =
    product.imageUrl &&
    product.imageUrl !== 'none' &&
    product.imageUrl.trim() !== '';

const imageSrc = hasValidImage
    ? product.imageUrl
    : fallbackImage;

const cardHTML = `
    <div class="product-card" onclick="location.href='product.html?id=${product.id}'" 
    style="cursor:pointer; ${isClosed ? 'opacity: 0.8;' : ''}"> <div class="img-area">
            <img src="${imageSrc}" class="product-thumbnail" 
            style="${isClosed ? 'filter: grayscale(0.5);' : ''}"> <div class="no-image-overlay" style="display:${hasValidImage ? 'none' : 'flex'};">
                등록된 사진이 없습니다
            </div>
        </div>

        <div class="card-body" style="padding:15px;">
            <div class="category-tag" style="font-size:12px; color:#888; margin-bottom:5px;">
                ${product.category} | 📍 ${product.location || '교내'}
            </div>

            <div class="product-title" style="font-size:18px; font-weight:700; margin-bottom:10px;">
                ${product.title}
            </div>

            <div class="progress-container" style="background:#eee; height:8px; border-radius:4px; margin-bottom:10px;">
                <div class="progress-fill" style="width:${percent}%; background:${isClosed ? '#aaa' : 'var(--main-burgundy)'}; height:100%; border-radius:4px;"></div>
            </div>

            <div class="card-footer" style="display:flex; justify-content:space-between; align-items:center;">
                <div class="price" style="font-weight:800; font-size:1.1rem; color:${isClosed ? '#888' : '#000'}">
                    ${Number(product.price).toLocaleString()}원
                </div>

                <div class="status" style="font-size:12px; font-weight:600; color:${isClosed ? '#aaa' : 'var(--main-burgundy)'}">
                    ${isClosed ? '모집마감' : `모집중 ${product.currentCount}/${product.targetCount}`}
                </div>
            </div>
        </div>
    </div>
`;
    roomGrid.insertAdjacentHTML('beforeend', cardHTML);
});

    // 더보기 버튼 표시 여부
    if(loadMoreArea) {
        loadMoreArea.style.display = displayCount < filteredProducts.length ? 'block' : 'none';
    }
}

// 4. 더보기 클릭 이벤트
if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
        displayCount += 6;
        renderGrid();
    });
}

// 실행!
fetchProducts();