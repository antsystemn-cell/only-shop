import { Navigate, useSearchParams } from "react-router-dom";

export default function LegacyItemRedirect() {
  const [params] = useSearchParams();
  const id = params.get("id");
  
  if (id) {
    return <Navigate to={`/ot/product/${id}`} replace />;
  }
  
  return <Navigate to="/" replace />;
}
