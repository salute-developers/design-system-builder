<#import "template.ftl" as layout>
<#import "passkeys.ftl" as passkeys>
<@layout.registrationLayout displayMessage=!messagesPerField.existsError('username','password') displayInfo=false; section>
    <#if section = "header">
        ${msg("loginAccountTitle")}
    <#elseif section = "form">
        <div id="kc-form">
            <div id="kc-form-wrapper">
                <#if realm.password>
                    <form id="kc-form-login" onsubmit="login.disabled = true; return true;" action="${url.loginAction}" method="post">
                        <div class="dsbuilder-fields">
                            <#if !usernameHidden??>
                                <div class="dsbuilder-field">
                                    <label for="username">${msg("username")}</label>
                                    <div class="dsbuilder-input-wrapper">
                                        <input id="username" name="username" value="${(login.username!'')}" type="text" placeholder="${msg('builderLoginPlaceholder')}"
                                            autofocus autocomplete="${(enableWebAuthnConditionalUI?has_content)?then('username webauthn', 'username')}"
                                            aria-invalid="${messagesPerField.existsError('username','password')?c}" <#if messagesPerField.existsError('username','password')>aria-describedby="input-error"</#if> />
                                    </div>
                                </div>
                            </#if>
                            <div class="dsbuilder-field">
                                <label for="password">${msg("password")}</label>
                                <div class="dsbuilder-input-wrapper">
                                    <input id="password" name="password" type="password" placeholder="${msg('builderPasswordPlaceholder')}" autocomplete="current-password"
                                        aria-invalid="${messagesPerField.existsError('username','password')?c}" <#if messagesPerField.existsError('username','password')>aria-describedby="input-error"</#if> />
                                </div>
                                <#if messagesPerField.existsError('username','password')>
                                    <span id="input-error" class="dsbuilder-input-error" aria-live="polite">${kcSanitize(messagesPerField.getFirstError('username','password'))?no_esc}</span>
                                </#if>
                            </div>
                        </div>
                        <div class="dsbuilder-actions">
                            <input type="hidden" id="id-hidden-input" name="credentialId" <#if auth.selectedCredential?has_content>value="${auth.selectedCredential}"</#if> />
                            <input class="dsbuilder-submit" name="login" id="kc-login" type="submit" value="${msg('doLogIn')}" />
                        </div>
                    </form>
                </#if>
            </div>
        </div>
        <@passkeys.conditionalUIData />
    <#elseif section = "socialProviders">
        <#if realm.password && social?? && social.providers?has_content>
            <div id="kc-social-providers" class="${properties.kcFormSocialAccountSectionClass!}">
                <h2>${msg("identity-provider-login-label")}</h2>
                <ul class="${properties.kcFormSocialAccountListClass!}">
                    <#list social.providers as p>
                        <li><a data-once-link data-disabled-class="${properties.kcFormSocialAccountListButtonDisabledClass!}" id="social-${p.alias}"
                            class="${properties.kcFormSocialAccountListButtonClass!}" href="${p.loginUrl}">${p.displayName!}</a></li>
                    </#list>
                </ul>
            </div>
        </#if>
    </#if>
</@layout.registrationLayout>
