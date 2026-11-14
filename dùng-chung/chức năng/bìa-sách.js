(function (global) {
  "use strict";
  var covers = [
    { title: "Muôn Kiếp Nhân Sinh", image: "https://firstnews.vn/upload/products/original/-1728467813.jpg", source: "https://firstnews.vn/muon-kiep-nhan-sinh-tag" },
    { title: "Khéo Ăn Khéo Nói", image: "https://chuonchuon.net/wp-content/uploads/2024/10/Review-sach-Kheo-an-noi-se-co-duoc-thien-ha.jpg", source: "https://chuonchuon.net/review-sach-kheo-an-noi-se-co-duoc-thien-ha-trac-nha/" },
    { title: "Hoàng Tử Bé", image: "https://cdn1.fahasa.com/media/catalog/product/i/m/image_187010.jpg", source: "https://www.fahasa.com/hoang-tu-be-tai-ban-2019-242711.html" },
    { title: "Sống Đơn Giản", image: "https://nxbcongthuong.vn/uploads/shops/2025/sdg-1-to.jpg", source: "https://nxbcongthuong.vn/shops/Sach-khoa-hoc/song-don-gian-cho-minh-thanh-than.html" },
    { title: "Cây Cam Ngọt Của Tôi", image: "https://cdn1.fahasa.com/media/catalog/product/i/m/image_217480.jpg", source: "https://www.fahasa.com/cay-cam-ngot-cua-toi.html" },
    { title: "Đắc Nhân Tâm", image: "https://cdn1.fahasa.com/media/catalog/product/i/m/image_143976.jpg", source: "https://www.fahasa.com/dac-nhan-tam-185500.html" },
    { title: "Hiểu Về Trái Tim", image: "https://cdn1.fahasa.com/media/catalog/product/z/4/z4118763446785_cf4bc22d353b065bbb37e686de1f9207.jpg", source: "https://www.fahasa.com/hieu-ve-trai-tim.html" },
    { title: "Nhà Giả Kim", image: "https://cdn1.fahasa.com/media/catalog/product/i/m/image_195509_1_36793.jpg", source: "https://www.fahasa.com/nha-gia-kim.html" }
  ];

  function normalize(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim();
  }

  function enhance(root) {
    (root || document).querySelectorAll(".stitch-book-card, .reader-book-card").forEach(function (card) {
      var title = card.querySelector(".stitch-book-name, h3");
      var container = card.querySelector(".stitch-book-cover, .reader-book-cover");
      if (!title || !container || container.querySelector(".book-cover-media")) return;
      var name = title.textContent.trim();
      var match = covers.find(function (entry) { return normalize(name).indexOf(normalize(entry.title)) === 0; });
      if (!match) return;
      var link = document.createElement("div");
      link.className = "book-cover-media";
      var image = document.createElement("img");
      image.className = "book-cover-image";
      image.alt = "Bìa sách " + match.title;
      image.loading = "lazy";
      image.decoding = "async";
      image.referrerPolicy = "no-referrer";
      image.width = 140;
      image.height = 200;
      image.addEventListener("load", function () { container.classList.add("has-book-image"); });
      image.addEventListener("error", function () { link.remove(); container.classList.remove("has-book-image"); });
      link.appendChild(image);
      container.appendChild(link);
      image.src = match.image;
    });
  }

  global.MocThu = global.MocThu || {};
  global.MocThu.biaSach = { enhance: enhance, covers: covers };
  enhance(document);
}(window));
