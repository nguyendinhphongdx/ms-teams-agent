# Từ code xong → chạy được trên Teams thật

Checklist đầy đủ, theo đúng thứ tự. Local dev (Agents Playground) không cần bước nào ở đây —
xem phần "Chạy thử local" trong [README.md](./README.md).

## Hai điểm hay gây rối nhất

**"Publish" — không cần làm.** Có 2 khái niệm khác tên:
- **Sideload / Upload custom app** (bước 6 dưới đây): cài app vào riêng team của công ty.
  Không ai duyệt, không công khai, vĩnh viễn tới khi gỡ. **→ Đây là cái cần làm.**
- **Publish lên Teams Store**: đưa app lên chợ ứng dụng công khai của Microsoft, cần Microsoft
  duyệt. Chỉ cần khi làm sản phẩm bán ra ngoài. **→ Bot nội bộ không cần.**

**Credentials — chỉ tạo 1 lần ở bước 1, dùng lại ở mọi bước sau.** `MicrosoftAppId` +
`MicrosoftAppPassword` + `MicrosoftAppTenantId` sinh ra cùng lúc khi tạo bot (bước 1), không có
credential nào khác cần tạo thêm. Bước 3 chỉ là dán **endpoint** vào đúng bot đó.

## Checklist

1. **Tạo Bot registration (credentials)**
   dev.teams.microsoft.com → Tools → Bot management → New Bot. Lấy 3 giá trị:
   `MicrosoftAppId` (Bot ID), `MicrosoftAppPassword` (client secret, chỉ hiện 1 lần lúc tạo),
   `MicrosoftAppTenantId` (tenant công ty). Lưu cả 3 vào `.env`.

2. **Có một URL public trỏ vào server**
   Microsoft phải gọi được tới `/api/messages` qua internet.
   Dev: `ngrok http 3978`. Thật: domain công ty qua Traefik.

3. **Điền endpoint vào bot registration**
   Developer Portal → bot vừa tạo → Configure → Endpoint address → dán URL ở bước 2 → Save.
   ngrok bản free đổi URL mỗi lần chạy lại → phải cập nhật lại ô này.

4. **Tạo Teams app gắn với bot**
   Developer Portal → Apps → New app → điền tên, mô tả → App features → Bot → chọn bot vừa tạo
   → scope tick **Team**. Bước này chỉ tạo ra file manifest, không publish gì cả.

5. **Xin IT bật "Upload custom apps"**
   Teams Admin Center → Teams apps → Setup policies → bật cho tài khoản/nhóm của bạn.
   Thiếu bước này, nút sideload sẽ không hiện trong Teams. Xem thêm ở cuối file.

6. **Sideload app vào team** (= cài đặt, KHÔNG phải publish)
   Trong team bạn là Owner → Apps → Upload a custom app → chọn file zip từ bước 4.

7. **Deploy server thật + bật xác thực**
   Build Docker image, chạy qua GitLab CI. Đổi endpoint trong Developer Portal sang domain thật
   (bỏ ngrok). Có `MicrosoftAppId` trong `.env` production → bot tự chuyển sang chế độ AUTH,
   từ chối mọi request thiếu JWT hợp lệ (xem `src/main.ts`).

8. **Test @mention trong channel thật**
   Gõ `@TênBot` ở bất kỳ channel nào của team đã cài ở bước 6 — sideload là theo TEAM,
   không phải theo từng channel. Không phản hồi → xem log server có nhận
   `POST /api/messages` không; không có nghĩa endpoint sai hoặc bot chưa vào đúng team.

## Nếu IT không bật "Upload custom apps" cho cả org

- **Giới hạn theo nhóm**: nhờ IT tạo riêng một setup policy chỉ bật upload custom app,
  gán cho tài khoản/nhóm dev, thay vì bật toàn công ty.
- **App submission**: nếu org có App submission policy, nộp app lên để admin duyệt và xuất
  hiện trong Manage apps của tenant — không cần quyền upload custom app, nhưng chậm hơn vì
  cần duyệt lại mỗi lần đổi manifest.

## Mẫu yêu cầu gửi IT

> Nhờ bật **"Upload custom apps"** trong Teams Admin Center → Teams apps → Setup policies,
> cho policy đang gán cho tài khoản `<email>`. Mình cần sideload một bot nội bộ (chưa publish
> ra store) để test.
