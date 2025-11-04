"use client";

import { useState, useEffect, useContext, useRef } from "react";
import { format } from "date-fns";
import { AuthContext } from "../App";
import supabase from "../SupaabseClient";

function DealerForm() {
  const [formData, setFormData] = useState({
    stateName: "",
    districtName: "",
    areaName: "",
    salesPersonName: "",
    dealerName: "",
    aboutDealer: "",
    address: "",
    dealerSize: "",
    avgQty: "",
    contactNumber: "",
    emailAddress: "",
    dob: "",
    anniversary: "",
    siteNature: "",
    photo: null,
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState("success");
  const [modalMessage, setModalMessage] = useState("");

  const [fetchedDealerSizes, setFetchedDealerSizes] = useState([]);
  const [isLoadingDealerSizes, setIsLoadingDealerSizes] = useState(true);
  const [errorDealerSizes, setErrorDealerSizes] = useState(null);

  // New state for sales person data
  const [fetchedSalesPersons, setFetchedSalesPersons] = useState([]);
  const [isLoadingSalesPersons, setIsLoadingSalesPersons] = useState(true);
  const [errorSalesPersons, setErrorSalesPersons] = useState(null);

  const [entityType, setEntityType] = useState("");

  // State for custom sales person dropdown
  const [isSalesPersonDropdownOpen, setIsSalesPersonDropdownOpen] =
    useState(false);
  const salesPersonDropdownRef = useRef(null);

  // New state for location data and photo
  const [photoLocation, setPhotoLocation] = useState(null);
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const fileInputRef = useRef(null);

  // Camera capture states - FIXED
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isCameraLoading, setIsCameraLoading] = useState(false);

  // Access currentUser and userRole from AuthContext
  const { currentUser, isAuthenticated } = useContext(AuthContext);
  const userRole = currentUser?.role || "User";

  const SPREADSHEET_ID_FOR_DEALER_SIZES =
    "15_ZUjQA-cSyFMt-70BxPBWVUZ185ioQzTqt5ElWXaZk";

  const DEFAULT_DEALER_SIZES = ["Small", "Medium", "Large"];
  
  // Site Nature options for Site/Engineer
  const SITE_NATURE_OPTIONS = [
    "Individual House",
    "Commercial",
    "Residential",
    "Other Project"
  ];

  /**
   * Get formatted address from coordinates using reverse geocoding
   */
  const getFormattedAddress = async (latitude, longitude) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
      );
      const data = await response.json();
      
      if (data && data.display_name) {
        return data.display_name;
      }
      return "Address not found";
    } catch (error) {
      console.error("Reverse geocoding error:", error);
      return "Unable to retrieve address";
    }
  };

  /**
   * Get current location with detailed information
   */
  const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by this browser"));
        return;
      }

      const options = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      };

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const latitude = position.coords.latitude;
          const longitude = position.coords.longitude;
          const mapLink = `https://www.google.com/maps?q=${latitude},${longitude}`;

          const formattedAddress = await getFormattedAddress(latitude, longitude);

          const locationInfo = {
            latitude,
            longitude,
            mapLink,
            formattedAddress,
            timestamp: new Date().toISOString(),
            accuracy: position.coords.accuracy,
          };

          resolve(locationInfo);
        },
        (error) => {
          const errorMessages = {
            1: "Location access denied. Please enable location services.",
            2: "Location information is unavailable.",
            3: "Location request timed out.",
          };
          reject(
            new Error(errorMessages[error.code] || "An unknown error occurred.")
          );
        },
        options
      );
    });
  };

  /**
   * Add location watermark to image
   */
  const addLocationWatermark = (file, location) => {
    return new Promise((resolve) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Draw original image
        ctx.drawImage(img, 0, 0);
        
        // Add location watermark
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(10, canvas.height - 100, canvas.width - 20, 90);
        
        ctx.fillStyle = 'white';
        ctx.font = '14px Arial';
        ctx.textAlign = 'left';
        
        const locationText = [
          `📍 ${location.formattedAddress}`,
          `📱 Lat: ${location.latitude.toFixed(6)}, Lng: ${location.longitude.toFixed(6)}`,
          `🕒 ${new Date(location.timestamp).toLocaleString()}`,
          `🎯 Accuracy: ${Math.round(location.accuracy)}m`
        ];
        
        locationText.forEach((text, index) => {
          ctx.fillText(text, 20, canvas.height - 70 + (index * 20));
        });

        // Convert back to file
        canvas.toBlob((blob) => {
          const watermarkedFile = new File([blob], file.name, {
            type: file.type,
            lastModified: Date.now()
          });
          resolve(watermarkedFile);
        }, file.type);
      };

      img.src = URL.createObjectURL(file);
    });
  };

  /**
   * Process photo with location
   */
  const processPhotoWithLocation = async (file) => {
    if (!file) return null;

    try {
      // Step 1: Show preview immediately
      const previewUrl = URL.createObjectURL(file);
      setPhotoPreview(previewUrl);
      
      // Step 2: Show location capture in progress
      setIsCapturingLocation(true);

      // Step 3: Capture location
      const location = await getCurrentLocation();
      setPhotoLocation(location);
      
      // Step 4: Add location watermark to image
      const processedImage = await addLocationWatermark(file, location);
      
      // Step 5: Update form data with processed image
      setFormData(prev => ({
        ...prev,
        photo: processedImage
      }));
      
      // Update preview with processed image
      const processedPreviewUrl = URL.createObjectURL(processedImage);
      setPhotoPreview(processedPreviewUrl);
      
      return { location, processedImage };
      
    } catch (error) {
      console.error("Photo processing failed:", error);
      setPhotoLocation(null);
      
      // If location fails, still keep the original photo
      setFormData(prev => ({
        ...prev,
        photo: file
      }));
      return { location: null, processedImage: file };
    } finally {
      setIsCapturingLocation(false);
    }
  };

  /**
   * Handle file upload with location processing
   */
  const handleFileUpload = async (file) => {
    if (!file) return;
    
    // Check if file is an image
    if (!file.type.startsWith('image/')) {
      showToast("❌ Please select an image file", "error");
      return;
    }
    
    await processPhotoWithLocation(file);
  };

  /**
   * Start camera for photo capture - FIXED
   */
  const startCamera = async () => {
    try {
      setCameraError("");
      setIsCameraLoading(true);
      
      // Check if camera is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError("Camera not supported on this device");
        setIsCameraLoading(false);
        return;
      }

      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment', // Prefer rear camera
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      
      setCameraStream(stream);
      setIsCameraOpen(true);
      
      // Wait for video to be ready
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for video to load
        await new Promise((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              resolve();
            };
          }
        });
        
        // Play the video
        await videoRef.current.play();
      }
      
    } catch (error) {
      console.error("Camera error:", error);
      if (error.name === 'NotAllowedError') {
        setCameraError("Camera access denied. Please allow camera permissions.");
      } else if (error.name === 'NotFoundError') {
        setCameraError("No camera found on this device.");
      } else {
        setCameraError("Unable to access camera. Please check permissions.");
      }
    } finally {
      setIsCameraLoading(false);
    }
  };

  /**
   * Stop camera and clean up - FIXED
   */
  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => {
        track.stop();
      });
      setCameraStream(null);
    }
    setIsCameraOpen(false);
    setCameraError("");
    setIsCameraLoading(false);
  };

  /**
   * Capture photo from camera - FIXED
   */
  const capturePhoto = async () => {
    if (!videoRef.current) {
      console.error("Video element not found");
      return;
    }

    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw current video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert canvas to blob with better quality
      canvas.toBlob(async (blob) => {
        if (blob) {
          // Create file from blob
          const file = new File([blob], `camera-capture-${Date.now()}.jpg`, {
            type: 'image/jpeg'
          });

          console.log("Photo captured successfully, file size:", blob.size);

          // Stop camera first
          stopCamera();

          // Process the captured photo with location
          await processPhotoWithLocation(file);
        } else {
          console.error("Failed to create blob from canvas");
          showToast("❌ Failed to capture photo", "error");
        }
      }, 'image/jpeg', 0.9); // Increased quality

    } catch (error) {
      console.error("Photo capture error:", error);
      showToast("❌ Failed to capture photo", "error");
    }
  };

  /**
   * Uploads photo to Supabase storage
   */
  const uploadPhotoToSupabase = async (file) => {
    if (!file) return null;

    try {
      // Create unique file name with timestamp
      const fileExt = file.name.split('.').pop();
      const timestamp = new Date().getTime();
      const fileName = `${timestamp}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      const filePath = `site-engineer-photos/${fileName}`;

      console.log("Uploading photo to Supabase storage...");

      // Upload file to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('image')
        .upload(filePath, file);

      if (uploadError) {
        throw new Error(`Photo upload failed: ${uploadError.message}`);
      }

      console.log("Photo uploaded successfully:", uploadData);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('image')
        .getPublicUrl(filePath);

      console.log("Public URL generated:", publicUrl);

      return publicUrl;

    } catch (error) {
      console.error("Photo upload error:", error);
      throw error;
    }
  };

  /**
   * Shows centered modal popup
   */
  const showToast = (message, type = "success") => {
    setModalMessage(message);
    setModalType(type);
    setShowModal(true);

    // Auto-hide after 3 seconds
    setTimeout(() => {
      setShowModal(false);
      setModalMessage("");
    }, 3000);
  };

  /**
   * Closes the modal popup manually
   */
  const closeModal = () => {
    setShowModal(false);
    setModalMessage("");
  };

  /**
   * Reset photo related states and clear file input
   */
  const resetPhotoData = () => {
    setPhotoPreview(null);
    setPhotoLocation(null);
    setFormData(prev => ({ ...prev, photo: null }));
    
    // Clear the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  /**
   * Fetches master data for dealer sizes from the specified Google Sheet.
   */
  const fetchMasterDataForDealerSizes = async () => {
    setIsLoadingDealerSizes(true);
    setErrorDealerSizes(null);
    try {
      const MASTER_SHEET_NAME = "Master";
      const tq = encodeURIComponent("select A where A is not null");

      const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID_FOR_DEALER_SIZES}/gviz/tq?tqx=out:json&tq=${tq}&sheet=${MASTER_SHEET_NAME}`;

      const response = await fetch(url);

      if (!response.ok)
        throw new Error(
          `Failed to fetch MASTER data: HTTP Status ${response.status}`
        );
      const text = await response.text();

      const jsonStart = text.indexOf("{");
      const jsonEnd = text.lastIndexOf("}");
      const data = JSON.parse(text.substring(jsonStart, jsonEnd + 1));

      let dealerSizes = [];
      if (data.table?.rows?.length > 0) {
        dealerSizes = data.table.rows
          .map((row) => {
            const cell = row.c[0];
            const value = cell && cell.v !== null ? String(cell.v).trim() : "";
            return value;
          })
          .filter((size) => {
            const lowerCaseSize = size.toLowerCase();
            return (
              size &&
              !["dealer size", "dealersize", "size"].includes(lowerCaseSize) &&
              !lowerCaseSize.startsWith("date(")
            );
          });
      }

      const uniqueDealerSizes = Array.from(new Set(dealerSizes));
      setFetchedDealerSizes(
        uniqueDealerSizes.length > 0 ? uniqueDealerSizes : DEFAULT_DEALER_SIZES
      );
    } catch (err) {
      console.error(`Error fetching MASTER data for dealer sizes:`, err);
      setErrorDealerSizes(`Failed to load dealer sizes: ${err.message}`);
      setFetchedDealerSizes(DEFAULT_DEALER_SIZES);
    } finally {
      setIsLoadingDealerSizes(false);
    }
  };

  const fetchSalesPersons = async () => {
    setIsLoadingSalesPersons(true);
    setErrorSalesPersons(null);
    try {
      const MASTER_SHEET_GID = "1319416673";
      const tq = encodeURIComponent("select G where G is not null");

      const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID_FOR_DEALER_SIZES}/gviz/tq?tqx=out:json&tq=${tq}&gid=${MASTER_SHEET_GID}`;

      const response = await fetch(url);

      if (!response.ok)
        throw new Error(
          `Failed to fetch sales persons data: HTTP Status ${response.status}`
        );
      const text = await response.text();

      const jsonStart = text.indexOf("{");
      const jsonEnd = text.lastIndexOf("}");
      const data = JSON.parse(text.substring(jsonStart, jsonEnd + 1));

      let salesPersons = [];
      if (data.table?.rows?.length > 0) {
        salesPersons = data.table.rows
          .map((row) => {
            const cell = row.c[0];
            const value = cell && cell.v !== null ? String(cell.v).trim() : "";
            return value;
          })
          .filter((name) => {
            const lowerCaseName = name.toLowerCase();
            return (
              name &&
              lowerCaseName !== "salesperson name" &&
              !lowerCaseName.startsWith("date(")
            );
          });
      }
      setFetchedSalesPersons(Array.from(new Set(salesPersons)));
    } catch (err) {
      console.error(`Error fetching sales persons data:`, err);
      setErrorSalesPersons(`Failed to load sales persons: ${err.message}`);
      setFetchedSalesPersons([]);
    } finally {
      setIsLoadingSalesPersons(false);
    }
  };

  // useEffect hook to fetch initial data and set up auto-fill/dropdown
  useEffect(() => {
    fetchMasterDataForDealerSizes();

    if (isAuthenticated) {
      if (userRole === "User" && currentUser?.salesPersonName) {
        setFormData((prev) => ({
          ...prev,
          salesPersonName: currentUser.salesPersonName,
        }));
      } else if (userRole === "Admin") {
        fetchSalesPersons();
      }
    }
  }, [isAuthenticated, userRole, currentUser]);

  // Effect for handling clicks outside the custom sales person dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        salesPersonDropdownRef.current &&
        !salesPersonDropdownRef.current.contains(event.target)
      ) {
        setIsSalesPersonDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [salesPersonDropdownRef]);

  // Clean up camera stream and photo preview URL when component unmounts
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [cameraStream, photoPreview]);

  /**
   * Handles changes to form input fields.
   */
  const handleInputChange = (e) => {
    const { name, value, type, files } = e.target;

    if (type === 'file') {
      const file = files[0];
      if (file) {
        handleFileUpload(file);
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
    
    // Clear error for the field if it was previously set
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  /**
   * Handles selection from the custom sales person dropdown.
   */
  const handleSalesPersonSelect = (name) => {
    setFormData((prev) => ({
      ...prev,
      salesPersonName: name,
    }));
    setIsSalesPersonDropdownOpen(false);
    if (errors.salesPersonName) {
      setErrors((prev) => ({
        ...prev,
        salesPersonName: "",
      }));
    }
  };

  /**
   * Validates the form data before submission.
   */
  const validateForm = () => {
    const newErrors = {};

    if (!formData.dealerName.trim() || formData.dealerName.length < 2) {
      newErrors.dealerName = "Dealer name must be at least 2 characters";
    }
    if (!formData.contactNumber.trim() || formData.contactNumber.length < 10) {
      newErrors.contactNumber = "Contact number must be at least 10 digits";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handles the form submission.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      showToast("❌ Please correct the errors in the form.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const date = new Date().toISOString();

      const formattedDob = formData.dob
        ? new Date(formData.dob).toISOString()
        : null;
      const formattedAnniversary = formData.anniversary
        ? new Date(formData.anniversary).toISOString()
        : null;

      // Upload photo and get URL (for Site/Engineer only)
      let photoUrl = null;

      if (formData.photo && entityType === "Site/Engineer") {
        photoUrl = await uploadPhotoToSupabase(formData.photo);
        console.log("Photo uploaded successfully:", photoUrl);
      }

      // Supabase insert data object
      const insertData = {
        state_name: formData.stateName,
        district_name: formData.districtName,
        area_name: formData.areaName,
        sales_person_name: formData.salesPersonName,
        dealer_name: formData.dealerName,
        about_dealer: formData.aboutDealer,
        address: formData.address,
        contact_number: formData.contactNumber,
        email_address: formData.emailAddress,
        planned: date,
        image_url: photoUrl || null,
        dealer_size: formData.dealerSize || formData.siteNature, 
        avg_qty: formData.avgQty,
        select_value: entityType,
        ...(entityType !== "Site/Engineer" && {
          date_of_birth: formattedDob,
          anniversary: formattedAnniversary,
        }),
      };

      console.log("Submitting data to Supabase:", insertData);
      
      // Supabase insert call
      const { data, error } = await supabase
        .from('FMS')
        .insert([insertData])
        .select();

      if (error) {
        throw error;
      }

      showToast(`✅ ${entityType} registered successfully!`);

      // Reset form data after successful submission
      setFormData({
        stateName: "",
        districtName: "",
        areaName: "",
        salesPersonName:
          userRole === "User" && currentUser?.salesPersonName
            ? currentUser.salesPersonName
            : "",
        dealerName: "",
        aboutDealer: "",
        address: "",
        dealerSize: "",
        avgQty: "",
        contactNumber: "",
        emailAddress: "",
        dob: "",
        anniversary: "",
        siteNature: "",
        photo: null,
      });
      
      // Reset photo data and clear file input
      resetPhotoData();
      setErrors({});
      
    } catch (error) {
      console.error("Submission error:", error);
      showToast(`❌ Error submitting form: ${error.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper function to check if entity type is Site/Engineer
  const isSiteEngineer = entityType === "Site/Engineer";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-blue-50 p-0 lg:p-8 font-inter">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Main Form Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 px-8 py-6 flex justify-between">
            <div>
              <h3 className="text-2xl font-bold text-white mb-2 ">
                Dealer Information
              </h3>
            <p className="text-purple-50 text-lg hidden md:block">
  Fill in the details about the dealer and sales person
</p>
            </div>

            <div className="max-w-xs">
              <select
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-white/20 rounded-xl shadow-sm focus:ring-2 focus:ring-white/50 focus:border-white/50 transition-all duration-200 text-slate-700 font-medium"
              >
                <option value="">Select Type</option>
                <option value="Dealer">Dealer</option>
                <option value="Distributor">Distributor</option>
                <option value="Site/Engineer">Site/Engineer</option>
              </select>
            </div>
          </div>
          <div className="p-2 lg:p-8">
            {entityType && (
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Location Information */}
                <div className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-3">
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-3">
                        State Name
                      </label>
                      <input
                        type="text"
                        name="stateName"
                        value={formData.stateName}
                        onChange={handleInputChange}
                        placeholder="Enter state name"
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-slate-700 font-medium"
                      />
                      {errors.stateName && (
                        <p className="text-red-500 text-sm mt-2 font-medium">
                          {errors.stateName}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-3">
                        District Name
                      </label>
                      <input
                        type="text"
                        name="districtName"
                        value={formData.districtName}
                        onChange={handleInputChange}
                        placeholder="Enter district name"
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-slate-700 font-medium"
                      />
                      {errors.districtName && (
                        <p className="text-red-500 text-sm mt-2 font-medium">
                          {errors.districtName}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-3">
                        Area Name
                      </label>
                      <input
                        type="text"
                        name="areaName"
                        value={formData.areaName}
                        onChange={handleInputChange}
                        placeholder="Enter area name"
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-slate-700 font-medium"
                      />
                      {errors.areaName && (
                        <p className="text-red-500 text-sm mt-2 font-medium">
                          {errors.areaName}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Personal Information */}
                <div className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-3">
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-3">
                        Sales Person Name
                      </label>
                      {userRole === "Admin" ? (
                        <div className="relative" ref={salesPersonDropdownRef}>
                          <button
                            type="button"
                            onClick={() =>
                              setIsSalesPersonDropdownOpen(
                                !isSalesPersonDropdownOpen
                              )
                            }
                            className={`w-full px-4 py-3 text-left bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-slate-700 font-medium flex justify-between items-center ${
                              isLoadingSalesPersons
                                ? "opacity-70 cursor-not-allowed"
                                : ""
                            }`}
                            disabled={isLoadingSalesPersons}
                          >
                            {formData.salesPersonName || "Select Sales Person"}
                            <svg
                              className={`w-4 h-4 ml-2 transition-transform ${
                                isSalesPersonDropdownOpen ? "rotate-180" : ""
                              }`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M19 9l-7 7-7-7"
                              ></path>
                            </svg>
                          </button>
                          {isSalesPersonDropdownOpen && (
                            <div className="absolute z-10 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                              {isLoadingSalesPersons ? (
                                <div className="px-4 py-2 text-slate-500">
                                  Loading sales persons...
                                </div>
                              ) : errorSalesPersons ? (
                                <div className="px-4 py-2 text-red-500">
                                  {errorSalesPersons}
                                </div>
                              ) : fetchedSalesPersons.length === 0 ? (
                                <div className="px-4 py-2 text-slate-500">
                                  No sales persons found.
                                </div>
                              ) : (
                                <ul>
                                  {fetchedSalesPersons.map((person) => (
                                    <li
                                      key={person}
                                      onClick={() =>
                                        handleSalesPersonSelect(person)
                                      }
                                      className="px-4 py-3 cursor-pointer hover:bg-slate-100 text-slate-700 font-medium"
                                    >
                                      {person}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <input
                          type="text"
                          name="salesPersonName"
                          value={formData.salesPersonName}
                          onChange={handleInputChange}
                          placeholder="Enter sales person name"
                          readOnly={userRole === "User"}
                          className={`w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-slate-700 font-medium ${
                            userRole === "User"
                              ? "bg-gray-50 cursor-not-allowed"
                              : ""
                          }`}
                        />
                      )}
                      {errors.salesPersonName && (
                        <p className="text-red-500 text-sm mt-2 font-medium">
                          {errors.salesPersonName}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-3">
                        **{entityType} Name
                      </label>
                      <input
                        type="text"
                        name="dealerName"
                        value={formData.dealerName}
                        onChange={handleInputChange}
                        placeholder="Enter dealer name"
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-slate-700 font-medium"
                      />
                      {errors.dealerName && (
                        <p className="text-red-500 text-sm mt-2 font-medium">
                          {errors.dealerName}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-3">
                        **Contact Number
                      </label>
                      <input
                        type="tel"
                        name="contactNumber"
                        value={formData.contactNumber}
                        onChange={handleInputChange}
                        placeholder="Enter contact number"
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-slate-700 font-medium"
                      />
                      {errors.contactNumber && (
                        <p className="text-red-500 text-sm mt-2 font-medium">
                          {errors.contactNumber}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-6 md:grid-cols-3">
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-3">
                        Email Address
                      </label>
                      <input
                        type="email"
                        name="emailAddress"
                        value={formData.emailAddress}
                        onChange={handleInputChange}
                        placeholder="Enter Email Address"
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-slate-700 font-medium"
                      />
                      {errors.emailAddress && (
                        <p className="text-red-500 text-sm mt-2 font-medium">
                          {errors.emailAddress}
                        </p>
                      )}
                    </div>
                    
                    {!isSiteEngineer && (
                      <>
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-slate-700 mb-3">
                            Date Of Birth
                          </label>
                          <input
                            type="date"
                            name="dob"
                            value={formData.dob}
                            onChange={handleInputChange}
                            placeholder="Date Of Birth"
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-slate-700 font-medium"
                          />
                          {errors.dob && (
                            <p className="text-red-500 text-sm mt-2 font-medium">
                              {errors.dob}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-slate-700 mb-3">
                            Anniversary
                          </label>
                          <input
                            type="date"
                            name="anniversary"
                            value={formData.anniversary}
                            onChange={handleInputChange}
                            placeholder="Anniversary Date"
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-slate-700 font-medium"
                          />
                          {errors.anniversary && (
                            <p className="text-red-500 text-sm mt-2 font-medium">
                              {errors.anniversary}
                            </p>
                          )}
                        </div>
                      </>
                    )}
                    
                    {isSiteEngineer && (
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-slate-700 mb-3">
                          Site Nature
                        </label>
                        <select
                          name="siteNature"
                          value={formData.siteNature}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-slate-700 font-medium"
                        >
                          <option value="">Select Site Nature</option>
                          {SITE_NATURE_OPTIONS.map((nature) => (
                            <option key={nature} value={nature}>
                              {nature}
                            </option>
                          ))}
                        </select>
                        {errors.siteNature && (
                          <p className="text-red-500 text-sm mt-2 font-medium">
                            {errors.siteNature}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Business Information */}
                <div className="space-y-6">
                  <div className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-slate-700 mb-3">
                          About {entityType}
                        </label>
                        <textarea
                          name="aboutDealer"
                          value={formData.aboutDealer}
                          onChange={handleInputChange}
                          placeholder={`Enter information about the ${entityType.toLowerCase()}`}
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-slate-700 font-medium min-h-24 resize-none"
                        />
                        {errors.aboutDealer && (
                          <p className="text-red-500 text-sm mt-2 font-medium">
                            {errors.aboutDealer}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-slate-700 mb-3">
                          Address
                        </label>
                        <textarea
                          name="address"
                          value={formData.address}
                          onChange={handleInputChange}
                          placeholder={`Enter ${entityType.toLowerCase()} address`}
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-slate-700 font-medium min-h-24 resize-none"
                        />
                        {errors.address && (
                          <p className="text-red-500 text-sm mt-2 font-medium">
                            {errors.address}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                      {!isSiteEngineer && (
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-slate-700 mb-3">
                            {entityType} Size
                          </label>
                          <select
                            name="dealerSize"
                            value={formData.dealerSize}
                            onChange={handleInputChange}
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-slate-700 font-medium"
                            disabled={isLoadingDealerSizes}
                          >
                            <option value="">
                              {isLoadingDealerSizes
                                ? "Loading dealer sizes..."
                                : "Select dealer size"}
                            </option>
                            {fetchedDealerSizes.map((size) => (
                              <option key={size} value={size}>
                                {size}
                              </option>
                            ))}
                          </select>
                          {errors.dealerSize && (
                            <p className="text-red-500 text-sm mt-2 font-medium">
                              {errors.dealerSize}
                            </p>
                          )}
                          {errorDealerSizes && (
                            <p className="text-red-500 text-sm mt-2 font-medium">
                              {errorDealerSizes}
                            </p>
                          )}
                        </div>
                      )}

                      {isSiteEngineer ? (
                        <div className="flex flex-col md:flex-row gap-6 md:col-span-2">
                          <div className="w-full space-y-2">
                            <label className="block text-sm font-semibold text-slate-700 mb-3">
                              Upload Photo (with Location Capture)
                            </label>
                            
                            {photoPreview && (
                              <div className="mb-4 p-4 bg-green-50 rounded-xl border border-green-200">
                                <p className="text-green-700 font-medium mb-2">
                                  {photoLocation ? "✅ Photo with Location Watermark" : "📷 Photo Ready for Processing"}
                                </p>
                                <img 
                                  src={photoPreview} 
                                  alt="Preview" 
                                  className="w-full h-48 object-contain rounded-lg bg-gray-100"
                                  onError={(e) => {
                                    console.error("Error loading image preview");
                                    e.target.style.display = 'none';
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={resetPhotoData}
                                  className="mt-2 text-red-500 text-sm hover:text-red-700"
                                >
                                  Remove Photo
                                </button>
                              </div>
                            )}

                            <div className="flex flex-col sm:flex-row gap-3 mb-3">
                              <div className="flex-1">
                                <input
                                  ref={fileInputRef}
                                  type="file"
                                  name="photo"
                                  onChange={handleInputChange}
                                  accept="image/*"
                                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-slate-700 font-medium"
                                  disabled={isCapturingLocation}
                                />
                              </div>
                              
                              <button
                                type="button"
                                onClick={startCamera}
                                className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl shadow-sm transition-all duration-200 flex items-center justify-center gap-2"
                                disabled={isCapturingLocation || isCameraLoading}
                              >
                                {isCameraLoading ? (
                                  <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    Loading...
                                  </>
                                ) : (
                                  <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                    </svg>
                                    Take Photo
                                  </>
                                )}
                              </button>
                            </div>

                            {isCapturingLocation && (
                              <p className="text-blue-600 text-sm mt-2">
                                📍 Capturing location and processing image...
                              </p>
                            )}

                            {photoLocation && (
                              <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                                <p className="text-green-700 text-sm font-medium mb-1">
                                  ✅ Location captured and image processed!
                                </p>
                                <p className="text-green-600 text-xs">
                                  Address: {photoLocation.formattedAddress}
                                </p>
                                <p className="text-green-600 text-xs">
                                  Coordinates: {photoLocation.latitude.toFixed(6)}, {photoLocation.longitude.toFixed(6)}
                                </p>
                              </div>
                            )}

                            {errors.photo && (
                              <p className="text-red-500 text-sm mt-2 font-medium">
                                {errors.photo}
                              </p>
                            )}
                          </div>

                          <div className="w-full space-y-2">
                            <label className="block text-sm font-semibold text-slate-700 mb-3">
                              Average Quantity
                            </label>
                            <input
                              type="number"
                              name="avgQty"
                              value={formData.avgQty}
                              onChange={handleInputChange}
                              placeholder="Enter average quantity"
                              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-slate-700 font-medium"
                            />
                            {errors.avgQty && (
                              <p className="text-red-500 text-sm mt-2 font-medium">
                                {errors.avgQty}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-slate-700 mb-3">
                            Average Quantity
                          </label>
                          <input
                            type="number"
                            name="avgQty"
                            value={formData.avgQty}
                            onChange={handleInputChange}
                            placeholder="Enter average quantity"
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-slate-700 font-medium"
                          />
                          {errors.avgQty && (
                            <p className="text-red-500 text-sm mt-2 font-medium">
                              {errors.avgQty}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-200">
                  <button
                    type="submit"
                    disabled={
                      isSubmitting ||
                      (userRole === "Admin" && isLoadingSalesPersons) ||
                      isLoadingDealerSizes ||
                      isCapturingLocation
                    }
                    className={`w-full lg:w-auto bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 hover:from-purple-700 hover:via-blue-700 hover:to-indigo-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] ${
                      isSubmitting ||
                      (userRole === "Admin" && isLoadingSalesPersons) ||
                      isLoadingDealerSizes ||
                      isCapturingLocation
                        ? "opacity-50 cursor-not-allowed"
                        : ""
                    }`}
                  >
                    {isSubmitting ? `Registering ${entityType}...` : `Register ${entityType}`}
                  </button>
                </div>
              </form>
            )}

            {!entityType && (
              <div className="text-center py-12">
                <p className="text-slate-500 text-lg">
                  Please select a type from the dropdown above to continue
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Camera Modal - FIXED */}
      {isCameraOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-800">Take Photo</h3>
                <button
                  onClick={stopCamera}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>

              {cameraError ? (
                <div className="text-center py-8">
                  <p className="text-red-500 mb-4">{cameraError}</p>
                  <button
                    onClick={stopCamera}
                    className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative bg-black rounded-lg overflow-hidden mb-4">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-96 object-cover"
                    />
                    <canvas ref={canvasRef} className="hidden" />
                  </div>
                  
                  <div className="flex justify-center gap-4">
                    <button
                      onClick={capturePhoto}
                      className="px-8 py-3 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg shadow-sm transition-all duration-200 flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" fill="currentColor"/>
                      </svg>
                      Capture Photo
                    </button>
                    <button
                      onClick={stopCamera}
                      className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white font-medium rounded-lg shadow-sm transition-all duration-200"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Centered Modal Popup */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-10 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full mx-4 transform transition-all duration-300 scale-100">
            <div className="p-8 text-center">
              <div className="mx-auto mb-6 w-20 h-20 rounded-full flex items-center justify-center">
                {modalType === "success" ? (
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                    <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
                      <svg
                        className="w-8 h-8 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="3"
                          d="M5 13l4 4L19 7"
                        ></path>
                      </svg>
                    </div>
                  </div>
                ) : (
                  <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
                    <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center">
                      <svg
                        className="w-8 h-8 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="3"
                          d="M6 18L18 6M6 6l12 12"
                        ></path>
                      </svg>
                    </div>
                  </div>
                )}
              </div>

              <h2
                className={`text-2xl font-bold mb-4 ${
                  modalType === "success" ? "text-green-600" : "text-red-600"
                }`}
              >
                {modalType === "success" ? "Success!" : "Error!"}
              </h2>

              <p className="text-gray-600 text-lg mb-8 leading-relaxed">
                {modalMessage}
              </p>

              <button
                onClick={closeModal}
                className={`px-8 py-3 rounded-xl font-semibold text-white transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-4 ${
                  modalType === "success"
                    ? "bg-green-500 hover:bg-green-600 focus:ring-green-300"
                    : "bg-red-500 hover:bg-red-600 focus:ring-red-300"
                }`}
              >
                Ok
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DealerForm;