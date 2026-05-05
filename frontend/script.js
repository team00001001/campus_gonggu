fetch("http://127.0.0.1:8000/api/posts")
  .then(res => res.json())
  .then(data => {
    const container = document.getElementById("product-list");

    data.forEach(post => {
      const cardLink = document.createElement("a");
      cardLink.href = "detail.html";
      cardLink.className = "card-link";

      const card = document.createElement("article");
      card.className = "product-card";

      card.innerHTML = `
        <h2>${post.title}</h2>
        <p>${post.description}</p>
        <div class="card-info">
          <span>${post.people}</span>
          <span>${post.deadline}</span>
        </div>
        <button>참여하기</button>
      `;

      cardLink.appendChild(card);
      container.appendChild(cardLink);
    });
  });