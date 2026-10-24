# Quy tắc tính tiền và giải ngân đã thống nhất

## Công thức

Với `c_i` là tổng tiền một ví góp vào một dự án:

```text
QF = max(0, (tổng sqrt(c_i))² − tổng c_i)
matching dự kiến = QF, nếu tổng QF <= pool
matching dự kiến = pool × QF / tổng QF, nếu tổng QF > pool
trần = pool × maxMatchBps / 10000
matching thực nhận = min(matching dự kiến, trần)
chủ dự án claim = tiền góp trực tiếp + matching thực nhận
pool dư = pool − tổng matching thực nhận
```

Code dùng số nguyên micro-USDC, căn và chia làm tròn xuống. Một ví góp nhiều lần được cộng dồn trước khi lấy căn. Không chia lại phần dư sau khi áp trần. Pool ở đây là tổng quỹ đối ứng được ghi nhận trong Round, gồm cả khoản bổ sung trước khi chốt; không phải số dư token còn lại sau các lần claim.

Thứ hạng không phải đầu vào phân bổ tiền. Xếp hạng xét số người ủng hộ, QF thô, tiền góp trực tiếp; bằng cả ba thì đồng hạng. ID chỉ giữ thứ tự hiển thị.

## Ví dụ kiểm thử

Pool 100 USDC; A/B/C mỗi dự án có hai ví khác nhau góp 25 USDC/ví. Mỗi dự án có direct 50 và QF 50; tổng QF 150.

| Trần matching | Matching mỗi dự án | Claim mỗi dự án | Pool dư |
|---|---:|---:|---:|
| 30% | 30 USDC | 80 USDC | 10 USDC |
| 100% | 33,333333 USDC | 83,333333 USDC | 0,000001 USDC |

Tiền vào luôn bằng tổng tiền chủ dự án claim cộng phần admin rút: 100 + 150 = 250 USDC. Trần phụ thuộc Round; không đổi trần của Round đã deploy.

## Mã nguồn và kiểm chứng

- `src/lib/qf.ts`: `computeMatchingBigInt` tính matching; `computeRoundAllocation` tổng hợp direct, matching, tổng claim và leftover. Có comment tiếng Việt.
- `src/lib/roundStats.ts`: Dashboard dùng chung kết quả phân bổ; sau finalize ưu tiên leftover đã ghi trên chain.
- `contracts/src/QFRound.sol`: bổ sung comment giải thích trần, quỹ dư và claim; giữ nguyên thuật toán và ABI.
- `__tests__/agreed-settlement.test.ts`: kiểm tra hai ví dụ, pool dư khi nhu cầu thấp và khi không có dự án.
- `contracts/test/QFRound.t.sol`: bổ sung hai test finalize → claim → rút leftover, kiểm tra claim lần hai bị chặn và bảo toàn 250 USDC.

Kiểm tra local: 37 test frontend liên quan đạt; ESLint và TypeScript đạt. Chưa chạy được hai test Solidity mới vì môi trường hiện tại không có lệnh `forge`. Chạy lại bằng `cd contracts && forge test --match-test 'test_AgreedEqualProjects'` khi có Foundry. Chưa deploy hoặc gửi giao dịch.
