const params = new URLSearchParams(window.location.search);
const postId = params.get("id");

fetch(`http://127.0.0.1:8000/api/posts/${postId}`)
  .then(res => res.json())
  .then(post => {
    const detailCard = document.getElementById("detail-card");

    detailCard.innerHTML = `
      <h1>${post.title}</h1>
      <p class="description">${post.description}</p>

      <div class="detail-info">
        <p><strong>참여 인원:</strong> ${post.people}</p>
        <p><strong>마감:</strong> ${post.deadline}</p>
        <p><strong>가격:</strong> ${post.price}</p>
        <p><strong>거래 장소:</strong> ${post.place}</p>
      </div>

      <button class="join-btn">참여하기</button>
    `;
  });