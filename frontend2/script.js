const API_URL = 'https://campusgonggu-production.up.railway.app/products';

var _defaultImages = {
    '식재료 / 배달': 'images/default-food.png',
    '자취 / 생필품': 'images/default-living.png',
    '전공 / 문구': 'images/default-study.png',
    '기타 물품': 'images/default-etc.png'
};

function onImgError(img) {
    img.onerror = null;
    img.onload = null;
    img.src = _defaultImages[img.dataset.category] || 'images/default-etc.png';
    var overlay = img.parentElement && img.parentElement.querySelector('.no-image-overlay');
    if (overlay) overlay.style.display = 'flex';
}

function onImgSuccess(img) {
    if (img.naturalWidth === 0 || img.naturalHeight === 0) {
        onImgError(img);
    }
}
const roomGrid = document.getElementById('roomGrid');
const loadMoreArea = document.getElementById('loadMoreArea');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const resultText = document.getElementById('resultText');

let allProducts = [];      // 전체 데이터 저장용
let filteredProducts = []; // 필터링된 데이터 저장용
let displayCount = 6;      // 초기에 보여줄 개수

// 현재 열 수 × 2 = 한 번에 보여줄/추가할 행 수
function getCurrentCols() {
    const grid = document.getElementById('roomGrid');
    const m = grid && grid.className.match(/cols-(\d+)/);
    return m ? Number(m[1]) : 3;
}
function getPageSize() { return getCurrentCols() * 2; }

// URL에서 파라미터 미리 읽기
const urlParams = new URLSearchParams(window.location.search);
const currentCategory = urlParams.get('category');
const initialSearch = urlParams.get('search') || '';
const isHideClosed = urlParams.get('hideClosed') === 'true'; 

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
// 2. 필터링 로직
function applyFilter(keyword) {
    const term = keyword.toLowerCase().trim();

    filteredProducts = allProducts.filter(p => {
        // [중요] 카테고리가 주소창에 있을 때만 카테고리 필터링 적용
        const matchCat = currentCategory ? (p.category === currentCategory) : true;
        
        // 검색어 필터링
        const matchSearch = p.title.toLowerCase().includes(term) || 
                            p.category.toLowerCase().includes(term);
                            
        // ✨ 마감 숨기기 필터링 로직 추가
        // 이미 기한이 지났거나(isClosed) 인원이 다 찬 경우 마감된 것으로 판별
        const isProductClosed = p.isClosed || (p.currentCount >= p.targetCount);
        
        // 숨기기 옵션이 켜져있는데 마감된 상품이라면 걸러냄 (false 반환)
        const matchHideClosed = isHideClosed ? !isProductClosed : true;
        
        // 세 가지 조건(카테고리, 검색어, 숨기기)이 모두 맞는 것만 화면에 남김
        return matchCat && matchSearch && matchHideClosed; 
    });

    displayCount = getPageSize(); // 필터링 될 때마다 2행 분량으로 초기화
    renderGrid();
}

// 3. 화면에 그리기
function renderGrid() {
    if (!roomGrid) return;
    roomGrid.innerHTML = '';

    if (filteredProducts.length === 0) {
        roomGrid.innerHTML = `
            <div style="text-align:center; padding:60px 20px; grid-column:1/-1;">
                <svg width="72" height="72" viewBox="0 0 72 72" fill="none" style="margin-bottom:16px; opacity:0.3;">
                    <circle cx="32" cy="32" r="20" stroke="#8A1538" stroke-width="2.5"/>
                    <path d="M46 46l14 14" stroke="#8A1538" stroke-width="2.5" stroke-linecap="round"/>
                    <path d="M25 32h14M32 25v14" stroke="#8A1538" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <div style="font-size:1.05rem; font-weight:700; color:#333; margin-bottom:8px;">검색 결과가 없어요</div>
                <div style="font-size:0.9rem; color:#aaa;">다른 검색어나 카테고리로 시도해보세요</div>
            </div>`;
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
            data-category="${product.category}"
            style="${isClosed ? 'filter: grayscale(0.5);' : ''}"
            onerror="onImgError(this)" onload="onImgSuccess(this)"> <div class="no-image-overlay" style="display:${hasValidImage ? 'none' : 'flex'};">
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
                    ${(function() {
                        const base = Number(product.price) || 0;
                        const ship = Number(product.shipping_fee) || 0;
                        const cnt = Number(product.targetCount) || 1;
                        const pt = product.price_type || 'per';
                        const per = pt === 'total' ? Math.ceil((base + ship) / cnt) : Math.ceil(base + ship / cnt);
                        return per.toLocaleString();
                    })()}원 <span style="font-size:0.75rem; font-weight:500; color:#aaa;">/ 인당</span>
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
        displayCount += getPageSize();
        renderGrid();
    });
}

// 실행!
fetchProducts();