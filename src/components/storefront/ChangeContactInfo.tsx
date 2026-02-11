import { useState } from "react";
import { Loader2, Mail, Phone, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { getAnonymousSession } from "@/services/otSession";
import { changeEmail, changePhone, confirmEmail, confirmPhone } from "@/services/otApi";

export function ChangeContactInfo() {
  // Email
  const [newEmail, setNewEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  // Phone
  const [newPhone, setNewPhone] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneSent, setPhoneSent] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);

  const handleChangeEmail = async () => {
    if (!newEmail || !newEmail.includes("@")) {
      toast.error("Зөв имэйл хаяг оруулна уу");
      return;
    }
    setEmailLoading(true);
    try {
      const sessionId = await getAnonymousSession();
      await changeEmail(sessionId, newEmail);
      setEmailSent(true);
      toast.success("Баталгаажуулах код илгээгдлээ");
    } catch (err: any) {
      toast.error(err.message || "Имэйл солиход алдаа гарлаа");
    } finally {
      setEmailLoading(false);
    }
  };

  const handleConfirmEmail = async () => {
    if (!emailCode) {
      toast.error("Баталгаажуулах код оруулна уу");
      return;
    }
    setEmailLoading(true);
    try {
      const sessionId = await getAnonymousSession();
      await confirmEmail(sessionId, emailCode);
      toast.success("Имэйл амжилттай солигдлоо!");
      setNewEmail("");
      setEmailCode("");
      setEmailSent(false);
    } catch (err: any) {
      toast.error(err.message || "Баталгаажуулахад алдаа гарлаа");
    } finally {
      setEmailLoading(false);
    }
  };

  const handleChangePhone = async () => {
    if (!newPhone || newPhone.length < 8) {
      toast.error("Зөв утасны дугаар оруулна уу");
      return;
    }
    setPhoneLoading(true);
    try {
      const sessionId = await getAnonymousSession();
      await changePhone(sessionId, newPhone);
      setPhoneSent(true);
      toast.success("Баталгаажуулах код илгээгдлээ");
    } catch (err: any) {
      toast.error(err.message || "Утас солиход алдаа гарлаа");
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleConfirmPhone = async () => {
    if (!phoneCode) {
      toast.error("Баталгаажуулах код оруулна уу");
      return;
    }
    setPhoneLoading(true);
    try {
      const sessionId = await getAnonymousSession();
      await confirmPhone(sessionId, phoneCode);
      toast.success("Утасны дугаар амжилттай солигдлоо!");
      setNewPhone("");
      setPhoneCode("");
      setPhoneSent(false);
    } catch (err: any) {
      toast.error(err.message || "Баталгаажуулахад алдаа гарлаа");
    } finally {
      setPhoneLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Change Email */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4 text-primary" />
            Имэйл хаяг солих
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!emailSent ? (
            <>
              <div className="space-y-1.5">
                <Label>Шинэ имэйл</Label>
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="new@example.com"
                />
              </div>
              <Button onClick={handleChangeEmail} disabled={emailLoading} size="sm">
                {emailLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Код илгээх
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm text-primary">
                <CheckCircle2 className="h-4 w-4" />
                <span>Баталгаажуулах код <strong>{newEmail}</strong> руу илгээгдлээ</span>
              </div>
              <div className="space-y-1.5">
                <Label>Баталгаажуулах код</Label>
                <Input
                  value={emailCode}
                  onChange={(e) => setEmailCode(e.target.value)}
                  placeholder="123456"
                  maxLength={10}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleConfirmEmail} disabled={emailLoading} size="sm">
                  {emailLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Баталгаажуулах
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setEmailSent(false); setEmailCode(""); }}
                >
                  Цуцлах
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Change Phone */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Phone className="h-4 w-4 text-primary" />
            Утасны дугаар солих
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!phoneSent ? (
            <>
              <div className="space-y-1.5">
                <Label>Шинэ утасны дугаар</Label>
                <Input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="99119911"
                />
              </div>
              <Button onClick={handleChangePhone} disabled={phoneLoading} size="sm">
                {phoneLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Код илгээх
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm text-primary">
                <CheckCircle2 className="h-4 w-4" />
                <span>Баталгаажуулах код <strong>{newPhone}</strong> руу илгээгдлээ</span>
              </div>
              <div className="space-y-1.5">
                <Label>Баталгаажуулах код</Label>
                <Input
                  value={phoneCode}
                  onChange={(e) => setPhoneCode(e.target.value)}
                  placeholder="123456"
                  maxLength={10}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleConfirmPhone} disabled={phoneLoading} size="sm">
                  {phoneLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Баталгаажуулах
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setPhoneSent(false); setPhoneCode(""); }}
                >
                  Цуцлах
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
