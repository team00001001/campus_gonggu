const products = [
  { title: "생수 공동구매", current: 2, max: 5 },
  { title: "사과 공동구매", current: 3, max: 5 }
];

const list = document.getElementById("product-list");

products.forEach(p => {
  const div = document.createElement("div");
  div.className = "card";
  div.innerHTML = `
    <h3>${p.title}</h3>
    <p>${p.current}/${p.max}명</p>
    <button>참여하기</button>
  `;
  list.appendChild(div);
});
