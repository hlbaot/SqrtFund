"use client";

import type { DriveStep } from "driver.js";

const TOUR_STORAGE_KEY = "npower_tour_completed";

export function isTourCompleted(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(TOUR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function markTourCompleted(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TOUR_STORAGE_KEY, "true");
  } catch {
    // Ignore localStorage errors
  }
}

export async function startOnboardingTour(locale: "vi" | "en" = "vi") {
  // Dynamically import driver.js to ensure zero SSR side effects and keep main bundle light
  const { driver } = await import("driver.js");

  const isVi = locale === "vi";

  const steps: DriveStep[] = [
    {
      popover: {
        title: isVi ? "Chào mừng bạn đến với N-Power! 🎉" : "Welcome to N-Power! 🎉",
        description: isVi
          ? "N-Power là nền tảng Quadratic Funding (QF) minh bạch trên Avalanche Fuji Testnet. Nơi số đông sinh viên cùng quyết định dự án nào nhận được tài trợ! Hãy cùng dạo một vòng 1 phút để làm quen nhé."
          : "N-Power is a democratic Quadratic Funding platform on Avalanche Fuji Testnet. Students collectively decide which initiatives get funded! Let's take a quick 1-minute walkthrough.",
        side: "bottom",
        align: "center",
      },
    },
    {
      element: "#tour-brand",
      popover: {
        title: isVi ? "Biểu tượng N-Power" : "N-Power Brand",
        description: isVi
          ? "Bấm vào logo N-Power ở bất kỳ trang nào để quay về trang chủ hoặc làm mới thông tin dự án."
          : "Click the N-Power logo from anywhere to quickly return to the home page or refresh.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "#tour-nav",
      popover: {
        title: isVi ? "Thanh điều hướng chính" : "Main Navigation",
        description: isVi
          ? "Truy cập nhanh: Khám phá các vòng gọi vốn (Round), Đăng ký dự án cho câu lạc bộ (Register) và theo dõi hoạt động / đóng góp của bạn (My activity)."
          : "Quickly access: Active funding rounds, Project registration for student clubs, and your personal activity.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "#tour-wallet",
      popover: {
        title: isVi ? "Kết nối ví & Xác minh Sinh viên" : "Connect Wallet & Verify Student",
        description: isVi
          ? "Kết nối ví Web3 (MetaMask, Core...). Khi xác thực email trường đại học (@...edu.vn), mỗi khoản đóng góp của bạn sẽ kích hoạt hệ số nhân Matching từ Quỹ đối ứng của các nhà tài trợ!"
          : "Connect your Web3 wallet on Avalanche Fuji. Verifying your university email unlocks quadratic matching—multiplying your donation impact exponentially through the sponsor pool!",
        side: "bottom",
        align: "end",
      },
    },
    {
      element: "#tour-language",
      popover: {
        title: isVi ? "Chuyển đổi ngôn ngữ" : "Language Toggle",
        description: isVi
          ? "Hỗ trợ đầy đủ song ngữ Tiếng Việt và Tiếng Anh tức thì chỉ với một thao tác bấm."
          : "Seamlessly switch between Vietnamese and English anytime with a single click.",
        side: "bottom",
        align: "center",
      },
    },
    {
      element: "#tour-hero-actions",
      popover: {
        title: isVi ? "Bắt đầu hành động" : "Get Started",
        description: isVi
          ? "Bấm 'Xem các vòng' để khám phá và bình chọn các dự án sinh viên xuất sắc, hoặc 'Đăng ký dự án' để bắt đầu chiến dịch gây quỹ cho CLB của bạn!"
          : "Click 'Explore rounds' to support impactful student projects, or 'Register project' to fund your initiative!",
        side: "top",
        align: "start",
      },
    },
    {
      element: "#how-it-works",
      popover: {
        title: isVi ? "Cơ chế Quadratic Funding (QF)" : "How Quadratic Funding Works",
        description: isVi
          ? "Quy trình 3 bước minh bạch: 1. Đăng ký dự án -> 2. Sinh viên đóng góp -> 3. Phân bổ quỹ đối ứng dựa trên số lượng người ủng hộ thay vì số tiền của một cá nhân!"
          : "3 democratic steps: 1. Clubs submit ideas -> 2. Students donate -> 3. Sponsor pool matches based on supporter count rather than donation size!",
        side: "top",
        align: "center",
      },
    },
    {
      popover: {
        title: isVi ? "Bạn đã sẵn sàng! 🚀" : "You're All Set! 🚀",
        description: isVi
          ? "Hãy kết nối ví, khám phá các dự án sinh viên và cùng lan tỏa giá trị tri thức cộng đồng cùng N-Power!"
          : "Connect your wallet, discover student projects, and make a collective impact with N-Power!",
        side: "bottom",
        align: "center",
      },
    },
  ];

  // Mark as completed immediately when tour launches to prevent duplicate auto-triggering
  markTourCompleted();

  const driverObj = driver({
    animate: true,
    smoothScroll: true,
    allowClose: true,
    overlayColor: "rgb(6, 6, 12)",
    overlayOpacity: 0.82,
    stagePadding: 6,
    stageRadius: 8,
    popoverClass: "npower-tour-popover",
    showProgress: true,
    progressText: isVi ? "Bước {{current}} / {{total}}" : "Step {{current}} of {{total}}",
    nextBtnText: isVi ? "Tiếp tục →" : "Next →",
    prevBtnText: isVi ? "← Quay lại" : "← Back",
    doneBtnText: isVi ? "Hoàn tất ✓" : "Done ✓",
    closeBtnLabel: isVi ? "Đóng hướng dẫn" : "Close guide",
    skipMissingElement: true,
    onDestroyed: () => {
      markTourCompleted();
      window.dispatchEvent(new CustomEvent("npower-tour-closed"));
    },
    steps,
  });

  driverObj.drive();
  return driverObj;
}
