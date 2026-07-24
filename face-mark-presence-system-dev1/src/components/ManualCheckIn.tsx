import React, { useState } from "react";
import { Upload, Clock, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface ManualCheckInProps {
  onSubmit: (note: string, imageData?: File | Blob) => void;
  className?: string;
}

const ManualCheckIn: React.FC<ManualCheckInProps> = ({
  onSubmit,
  className,
}) => {
  const [note, setNote] = useState("");
  const [imageData, setImageData] = useState<File | Blob>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file");
      return;
    }

    setImageData(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Call the onSubmit prop with form data
    onSubmit(note, imageData);

    // Reset form
    setNote("");
    setImageData(null);
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-4", className)}>
      <div className="space-y-2">
        <Label htmlFor="note">Reason for manual check-in</Label>
        <Textarea
          id="note"
          placeholder="Please explain why you're using manual check-in..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          required
          className="min-h-[80px]"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="image">Upload a selfie (optional)</Label>

        {imageData ? (
          <div className="relative">
            <img
              src={URL.createObjectURL(imageData)}
              alt="Uploaded selfie"
              className="w-full h-40 object-cover rounded-md"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="absolute top-2 right-2"
              onClick={() => setImageData(null)}
            >
              Change
            </Button>
          </div>
        ) : (
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-md p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors">
            <input
              id="image"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <label htmlFor="image" className="cursor-pointer">
              <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground block">
                Click to upload a selfie
              </span>
            </label>
          </div>
        )}
      </div>

      <div className="flex justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => window.history.back()}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="flex-1 attendance-gradient"
          disabled={!note || isSubmitting}
        >
          {isSubmitting ? (
            <Clock className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ClipboardCheck className="mr-2 h-4 w-4" />
          )}
          Submit
        </Button>
      </div>
    </form>
  );
};

export default ManualCheckIn;
