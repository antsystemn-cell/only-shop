import { Link } from "react-router-dom";
import onlyLogo from "@/assets/only-logo.png";

const Index = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-blue">
      <div className="text-center">
        <img 
          src={onlyLogo} 
          alt="Only Logo" 
          className="mx-auto mb-8 h-32 w-auto"
        />
        <h1 className="mb-4 text-4xl font-bold text-white">Only</h1>
        <p className="mb-8 text-xl text-white/70">Монголын шилдэг онлайн дэлгүүр</p>
        <div className="flex gap-4 justify-center">
          <Link 
            to="/admin/login" 
            className="px-6 py-3 bg-brand-green text-brand-blue font-semibold rounded-lg hover:bg-brand-green/90 transition-colors"
          >
            Админ нэвтрэх
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Index;
