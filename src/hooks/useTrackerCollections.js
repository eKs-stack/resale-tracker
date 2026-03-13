import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { sanitizePackageDoc, sanitizeProductDoc } from "../utils/firestoreSanitizers";

export default function useTrackerCollections() {
  const [packages, setPackages] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let packagesLoaded = false;
    let productsLoaded = false;

    const stopPackages = onSnapshot(collection(db, "packages"), (snapshot) => {
      setPackages(
        snapshot.docs.map((docItem) => sanitizePackageDoc(docItem.data(), docItem.id))
      );
      packagesLoaded = true;
      if (packagesLoaded && productsLoaded) setLoading(false);
    }, (err) => {
      setError(err);
      setLoading(false);
    });

    const stopProducts = onSnapshot(collection(db, "products"), (snapshot) => {
      setProducts(
        snapshot.docs.map((docItem) => sanitizeProductDoc(docItem.data(), docItem.id))
      );
      productsLoaded = true;
      if (packagesLoaded && productsLoaded) setLoading(false);
    }, (err) => {
      setError(err);
      setLoading(false);
    });

    return () => {
      stopPackages();
      stopProducts();
    };
  }, []);

  return { packages, products, loading, error };
}
