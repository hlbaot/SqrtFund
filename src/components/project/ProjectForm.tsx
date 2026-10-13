"use client";

import React, { useState } from "react";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { qfRoundAbi } from "@/lib/contracts/abis";
import { useRound } from "@/hooks/useRound";
import { useLocale } from "@/lib/context/locale";
import { useToast } from "@/lib/context/toast";
import { getContractErrorMessage } from "@/lib/errors";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ProjectCard } from "@/components/project/ProjectCard";
import type { Project, ProjectCategory } from "@/types";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

export function ProjectForm() {
  const { t, locale } = useLocale();
  const { address, isConnected } = useAccount();
  const { addToast } = useToast();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { roundAddress, status: roundStatus } = useRound();

  const [name, setName] = useState("");
  const [category, setCategory] = useState<ProjectCategory>("technology");
  const [description, setDescription] = useState("");
  const [contactUrl, setContactUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const validate = () => {
    const errs: Record<string, string> = {};
    const nameBytes = new TextEncoder().encode(name.trim()).length;
    const descBytes = new TextEncoder().encode(description.trim()).length;
    const contactBytes = new TextEncoder().encode(contactUrl.trim()).length;
    const imgBytes = new TextEncoder().encode(imageUrl.trim()).length;

    if (!name.trim()) errs.name = t.register.validationNameRequired;
    else if (nameBytes > 60) errs.name = "Project name cannot exceed 60 bytes.";

    if (!description.trim()) errs.description = t.register.validationDescRequired;
    else if (descBytes > 280) errs.description = "Project description cannot exceed 280 bytes.";

    if (!contactUrl.trim() || !contactUrl.startsWith("http")) {
      errs.contactUrl = t.register.validationContactRequired;
    } else if (contactBytes > 200) {
      errs.contactUrl = "Link URL cannot exceed 200 bytes.";
    }

    if (imageUrl.trim() && imgBytes > 200) {
      errs.imageUrl = "Image URL cannot exceed 200 bytes.";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (!isConnected || !address) {
      addToast({
        type: "error",
        title: "Wallet not connected",
        description: "Please connect your wallet to register a project.",
      });
      return;
    }

    if (!roundAddress || !publicClient) {
      addToast({
        type: "error",
        title: "Round not active",
        description: "No active quadratic funding round found.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      addToast({
        type: "pending",
        title: "Registering project...",
        description: "Please confirm the transaction in your wallet.",
      });

      const hash = await writeContractAsync({
        address: roundAddress,
        abi: qfRoundAbi,
        functionName: "registerProject",
        args: [name.trim(), description.trim(), imageUrl.trim(), contactUrl.trim()],
      });

      addToast({
        type: "pending",
        title: "Confirming registration...",
        description: "Waiting for block confirmation on Avalanche Fuji.",
        txHash: hash,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        throw new Error("Registration transaction reverted.");
      }

      setIsSubmitted(true);
      addToast({
        type: "success",
        title: "Project registered!",
        description: "Your project was submitted and is pending admin approval.",
        txHash: hash,
      });
    } catch (err: unknown) {
      const msg = getContractErrorMessage(err);
      addToast({
        type: "error",
        title: "Registration failed",
        description: msg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Live preview project object
  const previewProject: Project = {
    id: "0",
    roundId: roundAddress ?? "1",
    name: name || (locale === "vi" ? "Tên câu lạc bộ sinh viên" : "Student Club Name"),
    shortDescription: description ? description.slice(0, 100) : "Project summary...",
    description: description || "Full project proposal description...",
    category,
    contactUrl: contactUrl || "https://t.me/your_club",
    imageUrl: imageUrl.trim() || undefined,
    ownerAddress: address || "0x0000000000000000000000000000000000000000",
    supporterCount: 0,
    totalDonated: 0,
    estimatedMatching: 0,
    status: "pending",
  };

  if (isSubmitted) {
    return (
      <div className="mx-auto max-w-xl border border-money/30 bg-money/10 p-8 text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center border border-money/40 bg-money/10 text-money">
          <CheckCircle2 className="h-8 w-8 stroke-[2.5]" />
        </div>
        <h2 className="text-xl font-bold text-foreground">{t.register.submittedTitle}</h2>
        <p className="text-sm text-foreground leading-relaxed">
          {t.register.submittedDesc}
        </p>
        <p className="mono-label text-xs text-muted">
          Status: <strong className="text-primary">Pending admin approval</strong>
        </p>
        <div className="pt-4 flex justify-center gap-3">
          <Link href="/my">
            <Button variant="primary">{t.register.viewInDashboard}</Button>
          </Link>
          <Button
            variant="secondary"
            onClick={() => {
              setIsSubmitted(false);
              setName("");
              setDescription("");
              setContactUrl("");
              setImageUrl("");
            }}
          >
            Submit another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Form area */}
      <div className="lg:col-span-7 border border-line bg-surface p-6">
        <h2 className="text-lg font-bold text-foreground mb-4">
          {t.register.formTitle}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              <option value="technology">Technology & Engineering</option>
              <option value="education">Education & Workshops</option>
              <option value="environment">Sustainability & Campus Green</option>
              <option value="arts">Arts, Sound & Creative</option>
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
              className={`w-full border bg-bg p-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 transition-colors ${
                errors.description
                  ? "border-primary focus:border-primary focus:ring-primary"
                  : "border-line-strong focus:border-primary focus:ring-primary"
              }`}
            />
            {errors.description && (
              <p className="text-xs font-medium text-primary" role="alert">
                {errors.description}
              </p>
            )}
            <p className="text-[11px] text-muted text-right">
              {description.length}/280 chars
            </p>
          </div>

          <Input
            label={`${t.register.contactLabel} (max 200 bytes)`}
            placeholder={t.register.contactPlaceholder}
            value={contactUrl}
            onChange={(e) => setContactUrl(e.target.value)}
            error={errors.contactUrl}
          />

          <Input
            label={`${t.register.imageLabel} (max 200 bytes)`}
            placeholder={t.register.imagePlaceholder}
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            error={errors.imageUrl}
            helperText="Link to project logo or screenshot (https://...)"
          />

          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              fullWidth
              disabled={isSubmitting || roundStatus === "closed" || roundStatus === "finalized"}
              isLoading={isSubmitting}
              className="py-3 font-bold"
            >
              {isSubmitting ? "Registering on Fuji..." : t.register.submitButton}
            </Button>
          </div>
        </form>
      </div>

      {/* Live Voter Card Preview */}
      <div className="lg:col-span-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">
            {t.register.previewTitle}
          </h3>
          <span className="text-xs text-money font-medium">Real-time update</span>
        </div>
        <ProjectCard project={previewProject} />
      </div>
    </div>
  );
}
