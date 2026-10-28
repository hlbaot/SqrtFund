"use client";
import { useProjectImageUpload } from "@/hooks/useProjectImageUpload";
import { parseEventLogs } from "viem";
import { projectsStore, projectKey } from "@/lib/store/projectsStore";

import { useRegistrationRounds } from "@/hooks/useRegistrationRounds";
import { useFormDraft } from "@/hooks/useFormDraft";
import { formDraftKey } from "@/lib/formDrafts";
import { factoryAddress, studentRegistryAddress, TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import { shortAddress } from "@/lib/format";
import { txToast } from "@/lib/txToast";
import { useTxFlow } from "@/hooks/useTxFlow";

import React, { useEffect, useRef, useState } from "react";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { qfRoundAbi } from "@/lib/contracts/abis";
import { useRound } from "@/hooks/useRound";
import { useLocale } from "@/lib/context/locale";
import { fmt } from "@/lib/copy";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ProjectCard } from "@/components/project/ProjectCard";
import type { Project, ProjectCategory } from "@/types";
import { StudentAccessGate } from "@/components/verify/StudentAccessGate";
import { useRole } from "@/hooks/useRole";
import { CheckCircle2, AlertCircle, Upload, X, Loader2 } from "lucide-react";
import Link from "next/link";

const PROJECT_DEFAULTS = { name: "", category: "technology", description: "", contactUrl: "", imageUrl: "" };
const SELECTION_DEFAULTS = { roundAddress: "" };

export function ProjectForm({ initialRound }: { initialRound?: string }) {
  const beginFlow = useTxFlow();
  const { t, locale } = useLocale();
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient({ chainId: TARGET_CHAIN_ID });
  const { writeContractAsync } = useWriteContract();
  const selectionKey = formDraftKey("project-selection", TARGET_CHAIN_ID, factoryAddress, address);
  const rememberedRound = useFormDraft(selectionKey, SELECTION_DEFAULTS);
  const selection = useRegistrationRounds(initialRound);
  const restoredSelection = useRef<string | undefined>(undefined);
  const selectRound = selection.selectRound;
  const selectionScope = `${selectionKey}:${initialRound ?? ""}`;
  useEffect(() => {
    if (!rememberedRound.ready || restoredSelection.current === selectionScope) return;
    restoredSelection.current = selectionScope;
    selectRound(initialRound || rememberedRound.values.roundAddress || undefined);
  }, [rememberedRound.ready, rememberedRound.values.roundAddress, selectionScope, initialRound, selectRound]);
  const selectedAddress = selection.roundAddress;
  const { roundAddress, endTime, status: roundStatus, isCancelled, isLoading: isRoundLoading, isError: isRoundError, refetch: refetchRound } = useRound(selectedAddress);
  const { isStudent, canParticipate } = useRole(selectedAddress);

  const draftKey = formDraftKey("project", TARGET_CHAIN_ID, factoryAddress, address, selectedAddress);
  const draft = useFormDraft(draftKey, PROJECT_DEFAULTS);
  const { name, description, contactUrl, imageUrl } = draft.values;
  const category = (["technology", "education", "environment", "arts"].includes(draft.values.category)
    ? draft.values.category : "technology") as ProjectCategory;
  const setField = (field: keyof typeof PROJECT_DEFAULTS, value: string) => {
    if (selectedAddress) rememberedRound.setField("roundAddress", selectedAddress);
    draft.setField(field, value);
  };
  const setName = (value: string) => setField("name", value);
  const setCategory = (value: ProjectCategory) => setField("category", value);
  const setDescription = (value: string) => setField("description", value);
  const setContactUrl = (value: string) => setField("contactUrl", value);
  const setImageUrl = (value: string) => setField("imageUrl", value);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const imageUpload = useProjectImageUpload({
    scope: `${address}:${chainId}:${draftKey}`,
    wallet: address,
    registry: studentRegistryAddress,
    allowed: Boolean(isConnected && address && chainId === TARGET_CHAIN_ID && isStudent && selectedAddress),
    onUploaded: url => {
      draft.setField("imageUrl", url);
      setErrors(previous => {
        const next = { ...previous }; delete next.imageUrl; return next;
      });
    },
  });
  const isUploadingImage = imageUpload.isUploading;
  const uploadMessages: Record<string, string> = {
    UPLOAD_TOO_LARGE: t.register.fileTooLarge,
    UPLOAD_INVALID_FILE: locale === "vi" ? "Ảnh không hợp lệ. Hãy chọn ảnh PNG, JPEG hoặc WebP còn nguyên vẹn, tối đa 16 triệu pixel và 8192 pixel mỗi chiều." : "Invalid image. Select an intact PNG, JPEG or WebP, up to 16 million pixels and 8192 pixels per side.",
    UPLOAD_CONFIG_MISSING: locale === "vi" ? "Máy chủ chưa cấu hình dịch vụ tải ảnh. Vui lòng liên hệ quản trị viên hoặc dùng đường dẫn ảnh có sẵn." : "Image uploads are not configured on the server. Contact the administrator or use an existing image URL.",
    CONFIG_MISSING: locale === "vi" ? "Máy chủ chưa cấu hình dịch vụ tải ảnh. Vui lòng liên hệ quản trị viên hoặc dùng đường dẫn ảnh có sẵn." : "Image uploads are not configured on the server. Contact the administrator or use an existing image URL.",
    UPLOAD_QUOTA_UNAVAILABLE: locale === "vi" ? "Không kiểm tra được hạn mức tải ảnh. Vui lòng thử lại sau hoặc dùng đường dẫn ảnh có sẵn." : "Unable to check the upload quota. Try again later or use an existing image URL.",
    UPLOAD_AUTH_UNAVAILABLE: locale === "vi" ? "Không kiểm tra được trạng thái xác minh ví. Vui lòng thử lại sau." : "Unable to check your wallet verification. Please try again later.",
    UPLOAD_PROVIDER_FAILED: locale === "vi" ? "Dịch vụ lưu ảnh gặp lỗi. Vui lòng thử lại sau hoặc dùng đường dẫn ảnh có sẵn." : "Image storage failed. Try again later or use an existing image URL.",
    UPLOAD_PROVIDER_PERMISSION_DENIED: locale === "vi" ? "Dịch vụ lưu ảnh chưa được cấp quyền tải ảnh. Vui lòng liên hệ quản trị viên hoặc dùng đường dẫn ảnh có sẵn." : "Image storage does not have upload permission. Contact the administrator or use an existing image URL.",
    UPLOAD_FORBIDDEN: locale === "vi" ? "Cần ví Student đã xác minh trên Fuji." : "A verified Student wallet on Fuji is required.",
    UPLOAD_QUOTA_EXCEEDED: locale === "vi" ? "Đã đạt giới hạn tải ảnh. Vui lòng thử lại sau." : "Image upload quota reached. Please try again later.",
    UPLOAD_ALREADY_USED: locale === "vi" ? "Yêu cầu này đã được sử dụng. Hãy chọn ảnh và ký lại." : "This request was already used. Select the image and sign again.",
    UPLOAD_AUTH_INVALID: locale === "vi" ? "Chữ ký tải ảnh không hợp lệ hoặc hết hạn. Hãy thử lại." : "Upload signature is invalid or expired. Please retry.",
    WALLET_REJECTED: t.verification.emailErrors.WALLET_REJECTED,
  };
  const uploadError = imageUpload.error ? uploadMessages[imageUpload.error] ?? t.register.uploadFailed : null;
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (selectedAddress) rememberedRound.setField("roundAddress", selectedAddress);
    await imageUpload.upload(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedScope, setSubmittedScope] = useState<string | undefined>();
  const isSubmitted = Boolean(draftKey && submittedScope === draftKey);
  useEffect(() => {
    setErrors({}); setIsSubmitting(false);
  }, [draftKey]);

  const validate = () => {
    const errs: Record<string, string> = {};
    const nameBytes = new TextEncoder().encode(name.trim()).length;
    const descBytes = new TextEncoder().encode(description.trim()).length;
    const contactBytes = new TextEncoder().encode(contactUrl.trim()).length;
    const imgBytes = new TextEncoder().encode(imageUrl.trim()).length;

    if (!name.trim()) errs.name = t.register.validationNameRequired;
    else if (nameBytes > 60) errs.name = t.register.nameTooLong;

    if (!description.trim()) errs.description = t.register.validationDescRequired;
    else if (descBytes > 280) errs.description = t.register.descTooLong;

    if (!contactUrl.trim() || !contactUrl.startsWith("http")) {
      errs.contactUrl = t.register.validationContactRequired;
    } else if (contactBytes > 200) {
      errs.contactUrl = t.register.contactTooLong;
    }

    if (imageUrl.trim() && imgBytes > 200) {
      errs.imageUrl = t.register.imageTooLong;
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const toastId = "register-project";
    if (!isConnected || !address) {
      txToast.error(toastId, t.toasts.walletNotConnected, t.toasts.walletNotConnectedDesc);
      return;
    }
    if (chainId !== TARGET_CHAIN_ID) {
      txToast.error(toastId, t.wallet.switchNetwork);
      return;
    }
    if (!selectedAddress || roundAddress?.toLowerCase() !== selectedAddress.toLowerCase()
      || selection.isLoading || isRoundLoading || isRoundError || !publicClient
      || isCancelled || roundStatus !== "open" || endTime === undefined
      || BigInt(Math.floor(Date.now() / 1000)) >= endTime) {
      txToast.error(toastId, t.register.roundNotReady);
      return;
    }
    if (!isStudent || !canParticipate) {
      txToast.error(toastId, t.verification.title, t.verification.roundNotEligible);
      return;
    }
    if (!draft.ready || isUploadingImage || !validate()) return;
    const flow = beginFlow("register-project", { patch: receipt => {
      const event = parseEventLogs({ abi: qfRoundAbi, eventName: "ProjectRegistered", logs: receipt.logs.filter(log => log.address.toLowerCase() === selectedAddress.toLowerCase()) })[0];
      return event ? [projectsStore.getState().patch(projectKey(selectedAddress, event.args.id), {
        description: description.trim(), shortDescription: description.trim().slice(0, 100), imageUrl: imageUrl.trim() || "/images/placeholder.svg", contactUrl: contactUrl.trim(), category,
      }, true)] : [];
    } });

    setIsSubmitting(true);
    try {
      flow.toast.pending(
        toastId,
        t.toasts.registerTitle,
        t.toasts.registerDesc
      );

      const hash = await flow.wait(() => writeContractAsync({
        address: selectedAddress,
        chainId: TARGET_CHAIN_ID,
        abi: qfRoundAbi,
        functionName: "registerProject",
        args: [name.trim(), description.trim(), imageUrl.trim(), contactUrl.trim()],
      }));

      flow.toast.pending(
        toastId,
        t.toasts.registerConfirm,
        t.toasts.registerConfirmDesc,
        hash
      );

      const receipt = await flow.wait(() => publicClient.waitForTransactionReceipt({ hash }), 120_000);
      if (receipt.status !== "success") {
        throw new Error("Registration transaction reverted.");
      }

      draft.clearSubmitted();
      setSubmittedScope(draftKey);
      flow.toast.success(
        toastId,
        t.toasts.registerSuccess,
        t.toasts.registerSuccessDesc,
        hash
      );
    } catch (err: unknown) {
      if (flow.cancelled) return false;
      flow.error(
        toastId,
        err,
        t.toasts.registerFailed,
        locale
      );
    } finally {
      flow.finish();
      if (!flow.cancelled) {
        setIsSubmitting(false);
      }
    }
  };

  // Live preview project object
  const previewProject: Project = {
    id: "0",
    roundId: roundAddress ?? selectedAddress ?? "1",
    name: name || (locale === "vi" ? "Tên câu lạc bộ sinh viên" : "Student Club Name"),
    shortDescription: description ? description.slice(0, 100) : "Project summary...",
    description: description || "Full project proposal description...",
    category,
    contactUrl: contactUrl || "https://example.com/demo",
    imageUrl: imageUrl.trim() || undefined,
    ownerAddress: address || "0x0000000000000000000000000000000000000000",
    supporterCount: 0,
    totalDonated: 0,
    estimatedMatching: 0,
    status: "pending",
  };

  if (isSubmitted) {
    return (
      <div
        className="mx-auto max-w-xl border border-money/30 bg-money/10 p-8 text-center space-y-4"
        data-aos="zoom-in"
        data-aos-duration="500"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center border border-money/40 bg-money/10 text-money">
          <CheckCircle2 className="h-8 w-8 stroke-[2.5]" />
        </div>
        <h2 className="text-xl font-bold text-foreground">{t.register.submittedTitle}</h2>
        <p className="text-sm text-foreground leading-relaxed">
          {t.register.submittedDesc}
        </p>
        <p className="mono-label text-xs text-muted">
          {t.common.statusPendingAdmin}
        </p>
        <div className="pt-4 flex justify-center gap-3">
          <Link href="/my">
            <Button variant="primary">{t.register.viewInDashboard}</Button>
          </Link>
          <Button
            variant="secondary"
            onClick={() => {
              setSubmittedScope(undefined);
              draft.clear();
              setErrors({});
              imageUpload.reset();
            }}
          >
            {t.common.submitAnother}
          </Button>
        </div>
      </div>
    );
  }

  if (!isStudent) return <StudentAccessGate />;

  const roundPicker = (
    <div className="space-y-2 rounded-sm border border-line bg-surface p-4">
      <label htmlFor="registration-round" className="block text-sm font-semibold text-foreground">{t.register.fundingRound}</label>
      <select
        id="registration-round"
        value={selectedAddress ?? ""}
        disabled={isSubmitting || !rememberedRound.ready || selection.isLoading || selection.rounds.length === 0}
        onChange={event => { selection.selectRound(event.target.value); rememberedRound.setField("roundAddress", event.target.value); setErrors({}); }}
        className="min-h-11 w-full rounded-sm border border-line-strong bg-bg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
      >
        {!selectedAddress && <option value="">{t.register.selectRound}</option>}
        {selection.rounds.map(round => (
          <option key={round.address} value={round.address}>
            {fmt(t.register.roundOption, { number: round.number })}{round.name ? ` · ${round.name}` : ""} · {shortAddress(round.address)}
          </option>
        ))}
      </select>
      {selection.selectionUnavailable && <p role="status" className="text-sm text-muted">{t.register.roundUnavailable}</p>}
    </div>
  );
  const retryRounds = () => { selection.refetch(); refetchRound(); };
  if (selection.isLoading) return <div className="space-y-4">{roundPicker}<p role="status" className="text-sm text-muted">{t.register.loadingRounds}</p></div>;
  if ((selection.isError && selection.rounds.length === 0) || selection.selectedReadError || (selectedAddress && isRoundError)) {
    return <div className="space-y-4">{roundPicker}<div role="alert" className="space-y-3 rounded-sm border border-line bg-surface p-6 text-sm">
      <p>{t.register.roundsReadError}</p><Button type="button" variant="secondary" onClick={retryRounds}>{t.register.retryRounds}</Button>
    </div></div>;
  }
  if (!selectedAddress) return <div className="space-y-4">{roundPicker}{selection.rounds.length === 0 && <div role="status" className="space-y-3 rounded-sm border border-line bg-surface p-6 text-sm">
    <h2 className="font-semibold">{t.register.noOpenRounds}</h2>
    <p className="text-muted">{t.register.noOpenRoundsHint}</p>
    <Link href="/round" className="inline-flex min-h-10 items-center text-money hover:underline">{t.register.viewRounds}</Link>
  </div>}</div>;
  if (isRoundLoading) return <div className="space-y-4">{roundPicker}<p role="status" className="text-sm text-muted">{t.register.loadingRounds}</p></div>;

  return (
    <div className="space-y-6">
      {roundPicker}
      {selection.isError && <div role="alert" className="flex items-center gap-3 text-sm text-muted"><p>{t.register.roundsReadError}</p><Button type="button" variant="ghost" onClick={retryRounds}>{t.register.retryRounds}</Button></div>}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Form area */}
        <div
          className="lg:col-span-7 border border-line bg-surface p-6"
          data-aos="fade-right"
          data-aos-duration="600"
        >
          <h2 className="text-lg font-bold text-foreground mb-4">
            {t.register.formTitle}
          </h2>

          {!canParticipate && (
            <div className="mb-4 border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              <p>{chainId !== TARGET_CHAIN_ID ? t.wallet.switchNetwork : t.verification.roundNotEligible}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-4 max-w-[720px]">
            <fieldset disabled={!draft.ready || isSubmitting} className="space-y-4">
            <p className="text-sm text-muted">{t.phase2.ownerProjectLimit}</p>
            <Input
              label={`${t.register.nameLabel} (max 60 bytes)`}
              placeholder={t.register.namePlaceholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
            />

            <div className="space-y-1.5">
              <label
                htmlFor="project-category"
                className="block text-xs font-semibold uppercase tracking-wider text-foreground"
              >
                {t.register.categoryLabel}
              </label>
              <select
                id="project-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as ProjectCategory)}
                className="w-full border border-line-strong bg-bg px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="technology">{t.categories.technology}</option>
                <option value="education">{t.categories.education}</option>
                <option value="environment">{t.categories.environment}</option>
                <option value="arts">{t.categories.arts}</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="full-description"
                className="block text-xs font-semibold uppercase tracking-wider text-foreground"
              >
                {t.register.fullDescLabel} (max 280 bytes)
              </label>
              <textarea
                id="full-description"
                rows={4}
                maxLength={280}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t.register.fullDescPlaceholder}
                className={`w-full border bg-bg p-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 transition-colors ${errors.description
                  ? "border-primary focus:border-primary focus:ring-primary"
                  : "border-line-strong focus:border-primary focus:ring-primary"
                  }`}
              />
              {errors.description && (
                <p className="text-xs font-medium text-primary" role="alert">
                  {errors.description}
                </p>
              )}
              <p className="text-xs text-muted text-right">
                {fmt(t.register.charsCount, { count: description.length })}
              </p>
            </div>

            <Input
              label={`${t.register.contactLabel} (max 200 bytes)`}
              placeholder={t.register.contactPlaceholder}
              value={contactUrl}
              onChange={(e) => setContactUrl(e.target.value)}
              error={errors.contactUrl}
            />

            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-foreground">
                {t.register.imageLabel}
              </label>

              <p className="text-xs text-muted">{locale === "vi" ? "Chọn ảnh rồi ký bằng ví Student để tải lên. Hỗ trợ PNG, JPEG, WebP, tối đa 4MB; 5 lần/giờ và 20 lần/ngày." : "Select an image and sign with your Student wallet. PNG, JPEG, WebP up to 4MB; 5 uploads/hour and 20/day."}</p>
              <div className="flex flex-wrap items-center gap-2.5">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  id="project-image-file"
                />

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isUploadingImage}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 border-line-strong hover:border-primary text-xs font-medium cursor-pointer"
                >
                  {isUploadingImage ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      <span>{t.register.uploadingImage}</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-3.5 w-3.5 text-primary" />
                      <span>{imageUrl ? (locale === "vi" ? "Đổi ảnh khác" : "Change image") : t.register.uploadImage}</span>
                    </>
                  )}
                </Button>

                {imageUrl && (
                  <div className="flex items-center gap-2 bg-surface-2 px-3 py-1.5 rounded-xs border border-line text-xs">
                    <CheckCircle2 className="h-4 w-4 text-money shrink-0" />
                    <span className="text-foreground font-medium">
                      {locale === "vi" ? "Đã chọn ảnh dự án" : "Project image selected"}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setImageUrl("");
                        imageUpload.reset();
                      }}
                      className="text-muted hover:text-red-400 transition-colors p-0.5 cursor-pointer ml-1.5"
                      title={t.register.removeImage}
                      aria-label={t.register.removeImage}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <Input
                label={locale === "vi" ? "Hoặc dùng đường dẫn ảnh có sẵn" : "Or use an existing image URL"}
                type="url"
                placeholder="https://example.com/image.png"
                value={imageUrl}
                disabled={isUploadingImage}
                onChange={event => { setImageUrl(event.target.value); imageUpload.reset(); }}
                maxLength={200}
              />

              {uploadError && (
                <p className="text-xs text-primary font-medium" role="alert">
                  {uploadError}
                </p>
              )}

              {errors.imageUrl && (
                <p className="text-xs text-primary font-medium" role="alert">
                  {errors.imageUrl}
                </p>
              )}
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                fullWidth
                disabled={isSubmitting || isUploadingImage || roundStatus !== "open" || isCancelled || !canParticipate || chainId !== TARGET_CHAIN_ID}
                isLoading={isSubmitting}
                className="py-3 font-bold"
              >
                {!canParticipate
                  ? (chainId !== TARGET_CHAIN_ID ? t.wallet.switchNetwork : t.register.roundNotReady)
                  : isSubmitting
                    ? t.register.registeringOnFuji
                    : t.register.submitButton}
              </Button>
            </div>
            </fieldset>
          </form>
        </div>

        {/* Live Voter Card Preview */}
        <div
          className="lg:col-span-5 space-y-3"
          data-aos="fade-left"
          data-aos-duration="600"
        >
          <div className="flex items-center justify-between">
            <h3 className="role-label text-muted">
              {t.register.previewTitle}
            </h3>
            <span className="text-xs text-money font-medium">{t.common.realTimeUpdate}</span>
          </div>
          <ProjectCard
            project={previewProject}
            imageLayout="square"
            roundId={roundAddress ?? selectedAddress}
            roundAddress={roundAddress ?? selectedAddress}
          />
        </div>
      </div>
    </div>
  );
}
