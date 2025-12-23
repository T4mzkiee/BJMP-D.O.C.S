
import React, { useState, useRef, useEffect } from 'react';
import { SystemSettings } from '../types';
import { Save, Upload, Camera, Building2, Layout, Loader2, FileText, CheckCircle, RefreshCcw, AlertTriangle, X, Terminal, Copy } from 'lucide-react';
import { supabase, uploadFile } from '../utils/supabase';

interface SystemSettingsPageProps {
  settings: SystemSettings;
  onUpdate: (settings: SystemSettings) => void;
}

export const SystemSettingsPage: React.FC<SystemSettingsPageProps> = ({ settings, onUpdate }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSqlFix, setShowSqlFix] = useState(false);
  
  const [formData, setFormData] = useState({
    orgName: settings.orgName,
    appDescription: settings.appDescription,
    logoUrl: settings.logoUrl,
    logoLeftUrl: settings.logoLeftUrl,
    logoRightUrl: settings.logoRightUrl
  });

  // Sync internal state if props change (e.g. from a background realtime update)
  useEffect(() => {
    setFormData({
      orgName: settings.orgName,
      appDescription: settings.appDescription,
      logoUrl: settings.logoUrl,
      logoLeftUrl: settings.logoLeftUrl,
      logoRightUrl: settings.logoRightUrl
    });
    setPreviewUrl(settings.logoUrl);
    setPreviewLeftUrl(settings.logoLeftUrl || null);
    setPreviewRightUrl(settings.logoRightUrl || null);
  }, [settings]);

  // Logo Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileLeftInputRef = useRef<HTMLInputElement>(null);
  const fileRightInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedLeftFile, setSelectedLeftFile] = useState<File | null>(null);
  const [selectedRightFile, setSelectedRightFile] = useState<File | null>(null);
  
  const [previewUrl, setPreviewUrl] = useState<string | null>(settings.logoUrl);
  const [previewLeftUrl, setPreviewLeftUrl] = useState<string | null>(settings.logoLeftUrl || null);
  const [previewRightUrl, setPreviewRightUrl] = useState<string | null>(settings.logoRightUrl || null);

  const sqlFix = `-- Run this in Supabase SQL Editor:
ALTER TABLE system_settings 
ADD COLUMN IF NOT EXISTS logo_left_url TEXT,
ADD COLUMN IF NOT EXISTS logo_right_url TEXT;`;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'main' | 'left' | 'right') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) {
          alert("File size too large. Max 2MB allowed.");
          return;
      }
      
      const objectUrl = URL.createObjectURL(file);
      if (type === 'main') {
        setSelectedFile(file);
        setPreviewUrl(objectUrl);
      } else if (type === 'left') {
        setSelectedLeftFile(file);
        setPreviewLeftUrl(objectUrl);
      } else {
        setSelectedRightFile(file);
        setPreviewRightUrl(objectUrl);
      }
      setSaveError(null);
    }
  };

  const handleSave = async () => {
    if (!formData.orgName.trim()) {
        alert("Organization name is required.");
        return;
    }

    setIsSaving(true);
    setIsSyncing(true);
    setSaveError(null);
    setShowSqlFix(false);
    
    let finalLogoUrl = formData.logoUrl;
    let finalLogoLeftUrl = formData.logoLeftUrl;
    let finalLogoRightUrl = formData.logoRightUrl;

    try {
        // 1. Handle Uploads
        if (selectedFile) {
            const uploadedUrl = await uploadFile(selectedFile, 'avatars');
            if (uploadedUrl) finalLogoUrl = uploadedUrl;
        }
        if (selectedLeftFile) {
            const uploadedUrl = await uploadFile(selectedLeftFile, 'avatars');
            if (uploadedUrl) finalLogoLeftUrl = uploadedUrl;
        }
        if (selectedRightFile) {
            const uploadedUrl = await uploadFile(selectedRightFile, 'avatars');
            if (uploadedUrl) finalLogoRightUrl = uploadedUrl;
        }

        // 2. Sync to Supabase Database
        const SETTINGS_ID = settings.id === 'default' ? '00000000-0000-0000-0000-000000000001' : settings.id;

        const { data, error } = await supabase
            .from('system_settings')
            .upsert({
                id: SETTINGS_ID,
                org_name: formData.orgName,
                app_description: formData.appDescription,
                logo_url: finalLogoUrl,
                logo_left_url: finalLogoLeftUrl,
                logo_right_url: finalLogoRightUrl,
                updated_at: new Date().toISOString()
            }, { 
              onConflict: 'id',
              ignoreDuplicates: false 
            })
            .select()
            .single();

        if (error) {
            console.error("Database Sync Error:", error);
            // Check if column is missing (common cause for sync failed on new features)
            if (error.message.includes('column') || error.message.includes('schema cache') || error.code === 'PGRST204' || error.code === '42P01') {
                setShowSqlFix(true);
                throw new Error("The database table 'system_settings' is missing the new logo columns. Please run the SQL fix below.");
            }
            throw new Error(error.message || "Failed to synchronize with database.");
        }

        // 3. Update local state
        onUpdate({
            id: data.id,
            orgName: data.org_name,
            appDescription: data.app_description,
            logoUrl: data.logo_url,
            logoLeftUrl: data.logo_left_url,
            logoRightUrl: data.logo_right_url
        });

        setSelectedFile(null);
        setSelectedLeftFile(null);
        setSelectedRightFile(null);
        alert("System branding synchronized successfully!");
    } catch (err: any) {
        console.error("Sync error:", err);
        setSaveError(err.message || "An unexpected error occurred.");
    } finally {
        setIsSaving(false);
        setIsSyncing(false);
    }
  };

  const copySql = () => {
    navigator.clipboard.writeText(sqlFix);
    alert("SQL fix copied to clipboard!");
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-white">System Settings</h1>
          <p className="text-sm text-gray-400">Customize organization branding and application metadata.</p>
        </div>
        {isSyncing && (
            <div className="flex items-center text-blue-400 text-sm font-medium animate-pulse">
                <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                Syncing with Cloud...
            </div>
        )}
      </div>

      {saveError && (
          <div className="bg-red-900/20 border border-red-800/50 p-5 rounded-xl animate-shake">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                    <h4 className="text-red-400 font-bold text-sm">Synchronization Failed</h4>
                    <p className="text-red-300/80 text-xs mt-1 leading-relaxed">
                        {saveError}
                    </p>
                    
                    {showSqlFix && (
                        <div className="mt-4 space-y-3">
                            <div className="bg-black/40 rounded-lg border border-red-900/50 overflow-hidden">
                                <div className="flex items-center justify-between px-3 py-2 bg-red-900/20 border-b border-red-900/30">
                                    <span className="text-[10px] font-mono text-red-400 uppercase flex items-center">
                                        <Terminal className="w-3 h-3 mr-1.5" />
                                        SQL Fix Script
                                    </span>
                                    <button 
                                        onClick={copySql}
                                        className="text-red-400 hover:text-red-300 transition-colors"
                                        title="Copy SQL"
                                    >
                                        <Copy className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <pre className="p-3 text-[11px] font-mono text-gray-300 overflow-x-auto">
                                    {sqlFix}
                                </pre>
                            </div>
                            <p className="text-[10px] text-red-400/70 italic">
                                Note: After running this in Supabase, wait ~30 seconds and refresh this page.
                            </p>
                        </div>
                    )}
                </div>
                <button onClick={() => setSaveError(null)} className="text-red-500 hover:text-red-400">
                    <X className="w-4 h-4" />
                </button>
              </div>
          </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LOGO COLUMN */}
        <div className="lg:col-span-1 space-y-6">
            <div className="bg-gray-800 rounded-xl shadow-sm border border-gray-700 p-6 flex flex-col items-center relative overflow-hidden">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-6 w-full text-left">Logos Management</h3>
                
                {/* Main Org Logo */}
                <div className="w-full space-y-2 mb-8">
                  <label className="text-xs font-medium text-gray-500 uppercase">Organization Logo (Center)</label>
                  <div 
                      className="relative group cursor-pointer" 
                      onClick={() => !isSaving && fileInputRef.current?.click()}
                  >
                      <div className="w-full h-32 rounded-xl overflow-hidden border-2 border-dashed border-gray-600 group-hover:border-blue-500 transition-colors bg-gray-900 flex items-center justify-center">
                          {previewUrl ? (
                              <img src={previewUrl} alt="Logo Preview" className="w-full h-full object-contain p-2" />
                          ) : (
                              <div className="flex flex-col items-center text-gray-500">
                                  <FileText className="w-8 h-8 mb-1" />
                                  <span className="text-[10px]">No Logo</span>
                              </div>
                          )}
                      </div>
                      {!isSaving && (
                          <div className="absolute inset-0 bg-black bg-opacity-40 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Camera className="w-6 h-6 text-white" />
                          </div>
                      )}
                  </div>
                  <input type="file" ref={fileInputRef} onChange={e => handleFileChange(e, 'main')} className="hidden" accept="image/*" disabled={isSaving} />
                </div>

                {/* Additional Logos Row */}
                <div className="grid grid-cols-2 gap-4 w-full">
                    {/* Left Logo */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-500 uppercase">Logo 1 (Left)</label>
                        <div 
                            className="relative group cursor-pointer" 
                            onClick={() => !isSaving && fileLeftInputRef.current?.click()}
                        >
                            <div className="w-full h-24 rounded-lg overflow-hidden border-2 border-dashed border-gray-600 group-hover:border-blue-500 transition-colors bg-gray-900 flex items-center justify-center">
                                {previewLeftUrl ? (
                                    <img src={previewLeftUrl} alt="Logo Left" className="w-full h-full object-contain p-2" />
                                ) : (
                                    <div className="flex flex-col items-center text-gray-500">
                                        <FileText className="w-6 h-6" />
                                    </div>
                                )}
                            </div>
                            {!isSaving && (
                                <div className="absolute inset-0 bg-black bg-opacity-40 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Upload className="w-4 h-4 text-white" />
                                </div>
                            )}
                        </div>
                        <input type="file" ref={fileLeftInputRef} onChange={e => handleFileChange(e, 'left')} className="hidden" accept="image/*" disabled={isSaving} />
                    </div>

                    {/* Right Logo */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-500 uppercase">Logo 2 (Right)</label>
                        <div 
                            className="relative group cursor-pointer" 
                            onClick={() => !isSaving && fileRightInputRef.current?.click()}
                        >
                            <div className="w-full h-24 rounded-lg overflow-hidden border-2 border-dashed border-gray-600 group-hover:border-blue-500 transition-colors bg-gray-900 flex items-center justify-center">
                                {previewRightUrl ? (
                                    <img src={previewRightUrl} alt="Logo Right" className="w-full h-full object-contain p-2" />
                                ) : (
                                    <div className="flex flex-col items-center text-gray-500">
                                        <FileText className="w-6 h-6" />
                                    </div>
                                )}
                            </div>
                            {!isSaving && (
                                <div className="absolute inset-0 bg-black bg-opacity-40 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Upload className="w-4 h-4 text-white" />
                                </div>
                            )}
                        </div>
                        <input type="file" ref={fileRightInputRef} onChange={e => handleFileChange(e, 'right')} className="hidden" accept="image/*" disabled={isSaving} />
                    </div>
                </div>

                <p className="text-[10px] text-gray-500 mt-6 text-center px-2">
                    Recommended: Square PNG or SVG with transparent background. Max 2MB per file.
                </p>
            </div>

            {/* Live Preview Card */}
            <div className="bg-blue-900/10 border border-blue-900/30 rounded-xl p-6">
                <h4 className="text-blue-400 font-bold text-sm mb-4 flex items-center">
                    <Layout className="w-4 h-4 mr-2" />
                    Login Page Header Preview
                </h4>
                <div className="bg-gray-900 rounded-lg p-6 border border-gray-700 shadow-inner">
                    <div className="flex items-center justify-between mb-4">
                         <div className="w-10 h-10 flex items-center justify-center">
                             {previewLeftUrl ? <img src={previewLeftUrl} className="w-full h-full object-contain" alt="" /> : <div className="w-8 h-8 bg-gray-800 rounded" />}
                         </div>
                         <div className="w-14 h-14 flex items-center justify-center">
                             {previewUrl ? (
                                <img src={previewUrl} className="w-full h-full object-contain" alt="" />
                             ) : (
                                <div className="bg-blue-600 p-1.5 rounded-lg"><FileText className="w-6 h-6 text-white" /></div>
                             )}
                         </div>
                         <div className="w-10 h-10 flex items-center justify-center">
                             {previewRightUrl ? <img src={previewRightUrl} className="w-full h-full object-contain" alt="" /> : <div className="w-8 h-8 bg-gray-800 rounded" />}
                         </div>
                    </div>
                    <div className="text-center space-y-1">
                        <div className="h-3 w-3/4 bg-gray-700 rounded mx-auto"></div>
                        <div className="h-2 w-1/2 bg-gray-800 rounded mx-auto"></div>
                    </div>
                </div>
            </div>
        </div>

        {/* INFO COLUMN */}
        <div className="lg:col-span-2 space-y-6">
            <div className="bg-gray-800 rounded-xl shadow-sm border border-gray-700 p-8">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-6 flex items-center">
                    <Building2 className="w-4 h-4 mr-2" />
                    General Information
                </h3>

                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Organization Name</label>
                        <input 
                            type="text" 
                            value={formData.orgName}
                            onChange={e => setFormData({...formData, orgName: e.target.value})}
                            disabled={isSaving}
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-white transition-all disabled:opacity-50"
                            placeholder="Enter organization title"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Application Description</label>
                        <textarea 
                            value={formData.appDescription}
                            onChange={e => setFormData({...formData, appDescription: e.target.value})}
                            disabled={isSaving}
                            rows={4}
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-white transition-all resize-none disabled:opacity-50"
                            placeholder="Enter short description..."
                        />
                    </div>
                </div>

                <div className="mt-10 pt-6 border-t border-gray-700 flex justify-end">
                    <button 
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold flex items-center transition-all shadow-lg hover:shadow-blue-500/20 disabled:opacity-50 min-w-[200px] justify-center"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                Synchronizing...
                            </>
                        ) : (
                            <>
                                <CheckCircle className="w-5 h-5 mr-2" />
                                Save & Sync Branding
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
